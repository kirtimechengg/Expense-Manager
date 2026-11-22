/**
 * Excel (.xlsx) export, templates and import, using SheetJS.
 * Column names match the old app's templates, so your existing sheets still work.
 */
import * as XLSX from 'xlsx';

import { MONTHS_LONG, MONTHS_SHORT, todayKey } from './dates';
import {
  nameKey, parseFlexibleDate, parseImportAmount, parseType, type ImportPlan, type PlanCategory,
} from './import-plan';
import { monthlySeries } from './stats';
import type { Budget, Category, Transaction, TxnType } from './types';

const TYPE_LABEL: Record<TxnType, string> = { expense: 'Expense', income: 'Income', investment: 'Investment' };

function sheet(rows: Record<string, unknown>[], widths: number[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = widths.map((wch) => ({ wch }));
  return ws;
}

const toBase64 = (wb: XLSX.WorkBook): string => XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

/** Full data export. `prefix` limits it: "2026" (a year), "2026-11" (a month) or "" (everything). */
export function buildExportWorkbook(
  { transactions, categories, budgets, prefix }: { transactions: Transaction[]; categories: Category[]; budgets: Budget[]; prefix: string },
): string {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const inScope = (date: string) => date.startsWith(prefix);
  const txns = transactions.filter((t) => inScope(t.date)).sort((a, b) => a.date.localeCompare(b.date));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      txns.map((t) => ({
        Date: t.date, Type: TYPE_LABEL[t.type], Category: catName.get(t.categoryId) ?? 'Uncategorised', Amount: t.amount, Description: t.note,
      })),
      [12, 12, 22, 12, 40],
    ),
    'Transactions',
  );

  const years = [...new Set([...txns.map((t) => t.date), ...budgets.filter((b) => inScope(b.month)).map((b) => b.month)].map((d) => Number(d.slice(0, 4))))].sort();
  const summary: Record<string, unknown>[] = [];
  for (const y of years) {
    monthlySeries(txns, y).forEach((m, i) => {
      const key = `${y}-${String(i + 1).padStart(2, '0')}`;
      const budget = budgets.filter((b) => b.month === key).reduce((s, b) => s + b.amount, 0);
      if (!inScope(key) || (!m.income && !m.invested && !m.spent && !budget)) return;
      summary.push({ Month: `${MONTHS_SHORT[i]} ${y}`, Income: m.income, Invested: m.invested, Spent: m.spent, Budget: budget, 'Net cash': m.cash });
    });
  }
  XLSX.utils.book_append_sheet(wb, sheet(summary, [12, 12, 12, 12, 12, 12]), 'Monthly summary');

  const budgetRows = budgets
    .filter((b) => inScope(b.month) && catName.has(b.categoryId))
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((b) => ({ Year: Number(b.month.slice(0, 4)), Month: Number(b.month.slice(5, 7)), Category: catName.get(b.categoryId), Amount: b.amount, Remarks: b.remark }));
  XLSX.utils.book_append_sheet(wb, sheet(budgetRows, [8, 8, 22, 12, 30]), 'Budgets');

  return toBase64(wb);
}

export function buildExpenseTemplate(categories: Category[]): string {
  const [y, m, d] = todayKey().split('-');
  const date = `${d}-${m}-${y}`;
  const rows: Record<string, unknown>[] = [
    { Date: date, Type: 'Expense', Category: categories.find((c) => c.kind === 'expense')?.name ?? 'Food & Dining', Amount: 1500, Description: 'Example — delete this row' },
  ];
  const help = [
    { Column: 'Date', Rule: 'DD-MM-YYYY (e.g. 05-11-2026) or YYYY-MM-DD' },
    { Column: 'Type', Rule: 'Expense, Income or Investment' },
    { Column: 'Category', Rule: 'A category name from the list below. New names create new categories.' },
    { Column: 'Amount', Rule: 'Positive number, e.g. 1250.50' },
    { Column: 'Description', Rule: 'Optional note' },
    {},
    ...categories.map((c) => ({ Column: TYPE_LABEL[c.kind], Rule: c.name })),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(rows, [12, 12, 22, 12, 40]), 'Transactions');
  XLSX.utils.book_append_sheet(wb, sheet(help, [14, 60]), 'Help');
  return toBase64(wb);
}

export function buildBudgetTemplate(categories: Category[], year: number, month: number): string {
  const rows = categories
    .filter((c) => c.kind === 'expense')
    .map((c) => ({ Year: year, Month: month + 1, Category: c.name, Amount: 0, Remarks: '' }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(rows, [8, 8, 22, 12, 30]), 'Budgets');
  return toBase64(wb);
}

/** Reads the first sheet of an .xlsx / .xls / .csv file into rows with lower-case column names. */
export function readSheetRows(bytes: Uint8Array): Record<string, unknown>[] {
  const wb = XLSX.read(bytes, { type: 'array', cellDates: true });
  const first = wb.SheetNames[0];
  if (!first) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[first], { defval: '' });
  return raw.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), v])));
}

const cell = (row: Record<string, unknown>, ...names: string[]) => {
  for (const n of names) if (row[n] !== undefined && row[n] !== '') return row[n];
  return undefined;
};

function categoryResolver(categories: Category[]) {
  const planCats = new Map<string, PlanCategory>();
  const findExisting = (name: string) => categories.filter((c) => c.name.toLowerCase() === name.toLowerCase());
  return {
    planCats,
    /** Picks the category's kind: explicit Type column > existing category > fallback. */
    use(name: string, type: TxnType | null, fallback: TxnType) {
      const matches = findExisting(name);
      const kind = type ?? (matches.length === 1 ? matches[0].kind : matches.find((c) => c.kind === fallback)?.kind ?? fallback);
      const existing = matches.find((c) => c.kind === kind);
      const key = nameKey(kind, existing?.name ?? name);
      if (!planCats.has(key)) planCats.set(key, { key, name: existing?.name ?? name, kind });
      return { key, kind };
    },
  };
}

/** Rows with columns Date, Type, Category, Amount, Description. */
export function rowsToTransactionPlan(rows: Record<string, unknown>[], categories: Category[]): ImportPlan {
  const plan: ImportPlan = { source: 'Excel', categories: [], transactions: [], budgets: [], skipped: [] };
  const cats = categoryResolver(categories);
  rows.forEach((row, i) => {
    const line = `Row ${i + 2}`; // +1 header, +1 because spreadsheets start at 1
    const rawAmount = cell(row, 'amount');
    const name = String(cell(row, 'category') ?? '').trim();
    if (!name && (rawAmount === undefined || Number(rawAmount) === 0)) return; // empty template row
    const amount = parseImportAmount(rawAmount);
    const date = parseFlexibleDate(cell(row, 'date'));
    const rawType = cell(row, 'type');
    const type = parseType(rawType);
    if (amount === null) {
      if (Number(rawAmount) !== 0) plan.skipped.push(`${line}: invalid amount “${rawAmount ?? ''}”`);
      return;
    }
    if (!date) return void plan.skipped.push(`${line}: invalid date “${cell(row, 'date') ?? ''}”`);
    if (!name) return void plan.skipped.push(`${line}: missing category`);
    if (rawType !== undefined && !type) return void plan.skipped.push(`${line}: unknown type “${rawType}”`);
    const c = cats.use(name, type, 'expense');
    plan.transactions.push({
      type: c.kind, amount, date, categoryKey: c.key,
      note: String(cell(row, 'description', 'note', 'notes', 'remarks') ?? '').trim(),
    });
  });
  plan.categories = [...cats.planCats.values()];
  return plan;
}

/** Rows with columns Year, Month, Category, Amount, Remarks. */
export function rowsToBudgetPlan(rows: Record<string, unknown>[], categories: Category[]): ImportPlan {
  const plan: ImportPlan = { source: 'Excel', categories: [], transactions: [], budgets: [], skipped: [] };
  const cats = categoryResolver(categories);
  rows.forEach((row, i) => {
    const line = `Row ${i + 2}`;
    const name = String(cell(row, 'category') ?? '').trim();
    const rawAmount = cell(row, 'amount', 'budget');
    if (!name || rawAmount === undefined || Number(rawAmount) === 0) return; // blank rows are fine
    const amount = parseImportAmount(rawAmount);
    const year = Number(cell(row, 'year'));
    const month = parseMonth(cell(row, 'month'));
    if (amount === null) return void plan.skipped.push(`${line}: invalid amount “${rawAmount}”`);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) return void plan.skipped.push(`${line}: invalid year`);
    if (month === null) return void plan.skipped.push(`${line}: invalid month “${cell(row, 'month') ?? ''}”`);
    const c = cats.use(name, 'expense', 'expense');
    plan.budgets.push({
      categoryKey: c.key, month: `${year}-${String(month).padStart(2, '0')}`, amount,
      remark: String(cell(row, 'remarks', 'remark', 'note') ?? '').trim(),
    });
  });
  plan.categories = [...cats.planCats.values()];
  return plan;
}

/** 1-12, "Jan", "January" → 1..12 */
function parseMonth(v: unknown): number | null {
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  const s = String(v ?? '').trim().toLowerCase();
  const idx = MONTHS_LONG.findIndex((m) => m.toLowerCase() === s || m.slice(0, 3).toLowerCase() === s);
  return idx >= 0 ? idx + 1 : null;
}
