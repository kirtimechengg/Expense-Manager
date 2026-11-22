/**
 * Builds the HTML for the PDF report. expo-print turns this HTML into a PDF file.
 * Tip: to change how the PDF looks, edit the CSS at the bottom of this file.
 */
import { MONTHS_LONG, MONTHS_SHORT, friendlyDate, monthKey, type MonthRef } from './dates';
import { formatMoney } from './money';
import { byCategory, budgetLines, inMonth, inYear, monthlySeries, totalBudget, totalsOf } from './stats';
import type { Budget, Category, Transaction } from './types';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (n: number) => esc(formatMoney(n));

interface ReportInput {
  scope: 'month' | 'year';
  period: MonthRef;
  transactions: Transaction[];
  categories: Category[];
  budgets: Map<string, Budget>;
}

export function reportTitle({ scope, period }: Pick<ReportInput, 'scope' | 'period'>) {
  return scope === 'month' ? `${MONTHS_LONG[period.month]} ${period.year}` : `Year ${period.year}`;
}

export function buildReportHtml(input: ReportInput): string {
  const { scope, period, transactions, categories, budgets } = input;
  const txns = scope === 'month' ? inMonth(transactions, period) : inYear(transactions, period.year);
  const t = totalsOf(txns);
  const budget = totalBudget(budgets, scope === 'month' ? monthKey(period) : `${period.year}-`);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const name = (id: string) => esc(catById.get(id)?.name ?? 'Uncategorised');
  const savingsRate = t.income ? Math.round(((t.income - t.spent) / t.income) * 100) : 0;

  const tiles = [
    ['Income', money(t.income), 'income'],
    ['Invested', money(t.invested), 'invest'],
    ['Spent', money(t.spent), 'expense'],
    ['Net cash', money(t.cash), t.cash < 0 ? 'expense' : 'income'],
    ['Budget', budget ? money(budget) : '–', ''],
    ['Savings rate', `${savingsRate}%`, ''],
  ]
    .map(([label, value, cls]) => `<div class="tile"><div class="label">${label}</div><div class="value ${cls}">${value}</div></div>`)
    .join('');

  let sections = '';

  if (scope === 'month') {
    const lines = budgetLines(categories, budgets, transactions, period).filter((l) => l.budget || l.spent);
    if (lines.length) {
      sections += section('Budget vs spending', table(
        ['Category', 'Budget', 'Spent', 'Used', 'Remark'],
        lines.map((l) => [
          esc(l.category.name), l.budget ? money(l.budget) : '–', money(l.spent),
          l.budget ? `<span class="${l.spent > l.budget ? 'expense' : ''}">${Math.round((l.spent / l.budget) * 100)}%</span>` : '–',
          esc(l.remark),
        ]),
        [false, true, true, true, false],
      ));
    }
  } else {
    const series = monthlySeries(transactions, period.year);
    sections += section('Month by month', table(
      ['Month', 'Income', 'Invested', 'Spent', 'Budget', 'Net cash'],
      [
        ...series.map((m, i) => [
          MONTHS_SHORT[i], money(m.income), money(m.invested), money(m.spent),
          money(totalBudget(budgets, monthKey({ year: period.year, month: i }))),
          `<span class="${m.cash < 0 ? 'expense' : ''}">${money(m.cash)}</span>`,
        ]),
        ['<b>Total</b>', `<b>${money(t.income)}</b>`, `<b>${money(t.invested)}</b>`, `<b>${money(t.spent)}</b>`, `<b>${money(budget)}</b>`, `<b>${money(t.cash)}</b>`],
      ],
      [false, true, true, true, true, true],
    ));
  }

  for (const [kind, title] of [['expense', 'Spending by category'], ['investment', 'Investments by category'], ['income', 'Income by category']] as const) {
    const rows = byCategory(txns, kind);
    if (!rows.length) continue;
    sections += section(title, table(
      ['Category', 'Entries', 'Amount', 'Share'],
      rows.map((r) => [name(r.categoryId), String(r.count), money(r.total), `${Math.round(r.share * 100)}%`]),
      [false, true, true, true],
    ));
  }

  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
  sections += section(`Transactions (${sorted.length})`, sorted.length
    ? table(
      ['Date', 'Category', 'Note', 'Type', 'Amount'],
      sorted.map((x) => [
        esc(friendlyDate(x.date)), name(x.categoryId), esc(x.note),
        x.type === 'income' ? 'Income' : x.type === 'investment' ? 'Investment' : 'Expense',
        `<span class="${x.type === 'income' ? 'income' : x.type === 'investment' ? 'invest' : ''}">${money(x.amount)}</span>`,
      ]),
      [false, false, false, false, true],
    )
    : '<p class="muted">No transactions in this period.</p>');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Wallet report – ${esc(reportTitle(input))}</title>
<style>${CSS}</style></head><body>
<header><div><div class="brand">Wallet</div><h1>${esc(reportTitle(input))}</h1></div>
<div class="muted">Generated ${esc(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}</div></header>
<div class="tiles">${tiles}</div>
${sections}
</body></html>`;
}

function section(title: string, body: string) {
  return `<section><h2>${esc(title)}</h2>${body}</section>`;
}

function table(head: string[], rows: string[][], numeric: boolean[]) {
  const cls = (i: number) => (numeric[i] ? ' class="num"' : '');
  return `<table><thead><tr>${head.map((h, i) => `<th${cls(i)}>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td${cls(i)}>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 32px; font-size: 12px; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #5B4FE9; padding-bottom: 12px; margin-bottom: 20px; }
  .brand { color: #5B4FE9; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; font-size: 11px; }
  h1 { margin: 4px 0 0; font-size: 26px; }
  h2 { font-size: 15px; margin: 28px 0 10px; }
  .muted { color: #64748B; }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .tile { background: #F4F5FA; border-radius: 10px; padding: 12px 14px; }
  .label { color: #64748B; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; font-weight: 600; }
  .value { font-size: 18px; font-weight: 800; margin-top: 4px; }
  .income { color: #0EA371; } .invest { color: #2F6FEB; } .expense { color: #E5484D; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #64748B; border-bottom: 1px solid #E4E6EF; padding: 6px 8px; }
  td { border-bottom: 1px solid #F0F1F7; padding: 6px 8px; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr { page-break-inside: avoid; }
  section { page-break-inside: auto; }
`;
