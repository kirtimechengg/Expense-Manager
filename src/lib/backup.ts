/**
 * JSON backups.
 *  - Wallet format (this app): full copy of categories, transactions and budgets.
 *  - Legacy format (the old Gemini "Budget App"): converted on the fly so you keep your history.
 */
import { nameKey, parseFlexibleDate, parseImportAmount, type ImportPlan, type PlanCategory } from './import-plan';
import type { Budget, Category, Transaction, TxnType } from './types';

export const BACKUP_APP = 'wallet';
export const BACKUP_FORMAT = 1;

export interface WalletBackup {
  app: typeof BACKUP_APP;
  format: number;
  exportedAt: string;
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
}

export function buildBackup(categories: Category[], transactions: Transaction[], budgets: Budget[]): WalletBackup {
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), categories, transactions, budgets };
}

const TYPES: TxnType[] = ['expense', 'income', 'investment'];
const isType = (v: unknown): v is TxnType => TYPES.includes(v as TxnType);
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** Reads either backup format. Throws an Error with a friendly message if the file isn't a backup. */
export function parseBackup(text: string): ImportPlan {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!data || typeof data !== 'object') throw new Error('This file is not a Wallet backup.');
  const obj = data as Record<string, unknown>;
  if (obj.app === BACKUP_APP) return parseWallet(obj);
  if (Array.isArray(obj.categories) && Array.isArray(obj.expenses)) return parseLegacy(obj);
  throw new Error('This file is not a Wallet backup (or an old Budget App backup).');
}

function parseWallet(obj: Record<string, unknown>): ImportPlan {
  if (typeof obj.format !== 'number' || obj.format > BACKUP_FORMAT) {
    throw new Error('This backup was made by a newer version of the app. Please update the app first.');
  }
  const plan: ImportPlan = { source: 'Wallet backup', categories: [], transactions: [], budgets: [], skipped: [] };
  const cats = Array.isArray(obj.categories) ? obj.categories : [];
  for (const c of cats as Record<string, unknown>[]) {
    if (!c || !str(c.id) || !str(c.name).trim() || !isType(c.kind)) continue;
    plan.categories.push({ key: str(c.id), id: str(c.id), name: str(c.name).trim(), kind: c.kind, icon: str(c.icon) || undefined, color: str(c.color) || undefined });
  }
  const known = new Set(plan.categories.map((c) => c.key));
  const txns = Array.isArray(obj.transactions) ? obj.transactions : [];
  for (const [i, t] of (txns as Record<string, unknown>[]).entries()) {
    const amount = parseImportAmount(t?.amount);
    const date = parseFlexibleDate(t?.date);
    if (!t || !isType(t.type) || amount === null || !date || !known.has(str(t.categoryId))) {
      plan.skipped.push(`Transaction #${i + 1}: missing or invalid fields`);
      continue;
    }
    plan.transactions.push({
      id: str(t.id) || undefined, type: t.type, amount, date, categoryKey: str(t.categoryId), note: str(t.note),
      createdAt: str(t.createdAt) || undefined, updatedAt: str(t.updatedAt) || undefined,
    });
  }
  const budgets = Array.isArray(obj.budgets) ? obj.budgets : [];
  for (const b of budgets as Record<string, unknown>[]) {
    const amount = Number(b?.amount);
    if (!b || !known.has(str(b.categoryId)) || !/^\d{4}-\d{2}$/.test(str(b.month)) || !Number.isFinite(amount) || amount < 0) continue;
    plan.budgets.push({ categoryKey: str(b.categoryId), month: str(b.month), amount, remark: str(b.remark) });
  }
  return plan;
}

// ---- Old Gemini app ----

const LEGACY_INVEST_EXACT = ['pf', 'ppf', 'nps', 'mf'];
const LEGACY_INVEST_WORDS = ['investment', 'mutual fund', 'stock', 'saving', 'deposit', 'bonds', 'equity'];
/** The old app decided "is this an investment?" from the category name. */
export function legacyIsInvestment(name: string): boolean {
  const s = name.trim().toLowerCase();
  return LEGACY_INVEST_EXACT.includes(s) || LEGACY_INVEST_WORDS.some((w) => s.includes(w));
}
/** Descriptions the old app filled in automatically — not useful as notes. */
const LEGACY_DEFAULT_NOTES = new Set(['expense', 'income', 'assets & investments', 'imported']);

function parseLegacy(obj: Record<string, unknown>): ImportPlan {
  const plan: ImportPlan = { source: 'old Budget App backup', categories: [], transactions: [], budgets: [], skipped: [] };
  const nameById = new Map<string, string>();
  for (const c of obj.categories as Record<string, unknown>[]) {
    if (c && str(c.id) && str(c.name).trim()) nameById.set(str(c.id), str(c.name).trim());
  }

  const catMap = new Map<string, PlanCategory>();
  const categoryFor = (kind: TxnType, name: string) => {
    const key = nameKey(kind, name);
    if (!catMap.has(key)) catMap.set(key, { key, name, kind });
    return key;
  };
  // Bring over every old category, even unused ones.
  for (const name of nameById.values()) categoryFor(legacyIsInvestment(name) ? 'investment' : 'expense', name);

  for (const [i, e] of (obj.expenses as Record<string, unknown>[]).entries()) {
    const amount = parseImportAmount(e?.amount);
    const date = parseFlexibleDate(e?.date);
    if (!e || amount === null || !date) {
      plan.skipped.push(`Entry #${i + 1}: invalid amount or date`);
      continue;
    }
    const rawCat = str(e.categoryId);
    let type: TxnType;
    let name: string;
    if (str(e.type).toLowerCase() === 'income') {
      type = 'income';
      // Old income entries stored the category *name* in categoryId.
      name = nameById.get(rawCat) ?? (rawCat.trim() || 'Other Income');
    } else {
      name = nameById.get(rawCat) ?? 'Uncategorised';
      type = legacyIsInvestment(name) ? 'investment' : 'expense';
    }
    const desc = str(e.description).trim();
    plan.transactions.push({
      type, amount, date, categoryKey: categoryFor(type, name),
      note: LEGACY_DEFAULT_NOTES.has(desc.toLowerCase()) ? '' : desc,
      createdAt: str(e.timestamp) || undefined,
    });
  }

  if (obj.budgets && typeof obj.budgets === 'object') {
    for (const [key, val] of Object.entries(obj.budgets as Record<string, unknown>)) {
      const m = key.match(/^(\d{4})-(\d{2})-(.+)$/);
      const v = val as Record<string, unknown> | null;
      const amount = Number(v?.amount);
      const name = m ? nameById.get(m[3]) : undefined;
      if (!m || !name || !Number.isFinite(amount) || amount <= 0) continue;
      const kind = legacyIsInvestment(name) ? 'investment' : 'expense';
      plan.budgets.push({ categoryKey: categoryFor(kind, name), month: `${m[1]}-${m[2]}`, amount, remark: str(v?.remark) });
    }
  }

  plan.categories = [...catMap.values()];
  if (plan.skipped.length > 0 && plan.transactions.length === 0) throw new Error('No readable entries were found in this backup.');
  return plan;
}
