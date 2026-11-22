/**
 * All the maths behind the dashboards. These are "pure" functions:
 * data in → numbers out, no database or UI. Easy to read and test.
 */
import { daysInMonth, monthKey, type MonthRef } from './dates';
import type { Budget, Category, Transaction, TxnType } from './types';

export interface Totals {
  income: number;
  invested: number;
  spent: number;
  /** Money left after spending and investing: income − invested − spent. */
  cash: number;
}

export function emptyTotals(): Totals {
  return { income: 0, invested: 0, spent: 0, cash: 0 };
}

export function totalsOf(txns: Transaction[]): Totals {
  const t = emptyTotals();
  for (const x of txns) {
    if (x.type === 'income') t.income += x.amount;
    else if (x.type === 'investment') t.invested += x.amount;
    else t.spent += x.amount;
  }
  t.cash = t.income - t.invested - t.spent;
  return t;
}

export const inMonth = (txns: Transaction[], ref: MonthRef) => {
  const key = monthKey(ref);
  return txns.filter((t) => t.date.startsWith(key));
};

export const inYear = (txns: Transaction[], year: number) => {
  const prefix = `${year}-`;
  return txns.filter((t) => t.date.startsWith(prefix));
};

export interface CategoryShare {
  categoryId: string;
  total: number;
  count: number;
  /** 0..1 share of the overall total */
  share: number;
}

/** Totals per category for one transaction type, biggest first. */
export function byCategory(txns: Transaction[], type: TxnType): CategoryShare[] {
  const map = new Map<string, { total: number; count: number }>();
  let grand = 0;
  for (const t of txns) {
    if (t.type !== type) continue;
    const e = map.get(t.categoryId) ?? { total: 0, count: 0 };
    e.total += t.amount;
    e.count += 1;
    map.set(t.categoryId, e);
    grand += t.amount;
  }
  return [...map.entries()]
    .map(([categoryId, e]) => ({ categoryId, ...e, share: grand ? e.total / grand : 0 }))
    .sort((a, b) => b.total - a.total);
}

/** 12 entries (Jan..Dec) of totals for a year. */
export function monthlySeries(txns: Transaction[], year: number): Totals[] {
  const out = Array.from({ length: 12 }, emptyTotals);
  for (const t of inYear(txns, year)) {
    const m = Number(t.date.slice(5, 7)) - 1;
    const row = out[m];
    if (!row) continue;
    if (t.type === 'income') row.income += t.amount;
    else if (t.type === 'investment') row.invested += t.amount;
    else row.spent += t.amount;
  }
  for (const r of out) r.cash = r.income - r.invested - r.spent;
  return out;
}

/** Totals for the last `count` months ending at `end` (oldest first). */
export function recentMonths(txns: Transaction[], end: MonthRef, count: number) {
  const out: { ref: MonthRef; totals: Totals }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const total = end.year * 12 + end.month - i;
    const ref = { year: Math.floor(total / 12), month: total % 12 };
    out.push({ ref, totals: totalsOf(inMonth(txns, ref)) });
  }
  return out;
}

/** Spending per day of a month: index 0 = day 1. */
export function dailySpend(txns: Transaction[], ref: MonthRef): number[] {
  const out = new Array(daysInMonth(ref)).fill(0);
  for (const t of inMonth(txns, ref)) {
    if (t.type !== 'expense') continue;
    const d = Number(t.date.slice(8, 10)) - 1;
    if (d >= 0 && d < out.length) out[d] += t.amount;
  }
  return out;
}

export const budgetKey = (month: string, categoryId: string) => `${month}|${categoryId}`;

export interface BudgetLine {
  category: Category;
  budget: number;
  spent: number;
  remark: string;
}

/** Budget vs actual for every expense category in a month. */
export function budgetLines(
  categories: Category[],
  budgets: Map<string, Budget>,
  txns: Transaction[],
  ref: MonthRef,
): BudgetLine[] {
  const key = monthKey(ref);
  const spentBy = new Map(byCategory(inMonth(txns, ref), 'expense').map((c) => [c.categoryId, c.total]));
  return categories
    .filter((c) => c.kind === 'expense')
    .map((c) => {
      const b = budgets.get(budgetKey(key, c.id));
      return { category: c, budget: b?.amount ?? 0, remark: b?.remark ?? '', spent: spentBy.get(c.id) ?? 0 };
    });
}

export function totalBudget(budgets: Map<string, Budget>, monthPrefix: string): number {
  let sum = 0;
  for (const b of budgets.values()) if (b.month.startsWith(monthPrefix)) sum += b.amount;
  return sum;
}
