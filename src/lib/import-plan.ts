/**
 * An "import plan" is the common shape that every import source is converted into
 * (Wallet JSON backup, the old Gemini app backup, Excel files). The database code
 * in src/db/import.ts then applies a plan — so the tricky matching logic lives in one place.
 */
import type { TxnType } from './types';

export interface PlanCategory {
  /** Reference used by transactions/budgets in this plan. */
  key: string;
  name: string;
  kind: TxnType;
  icon?: string;
  color?: string;
  /** Keep this id if it's not already taken (Wallet backups). */
  id?: string;
}

export interface PlanTransaction {
  id?: string;
  type: TxnType;
  amount: number;
  categoryKey: string;
  date: string;
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanBudget {
  categoryKey: string;
  month: string;
  amount: number;
  remark: string;
}

export interface ImportPlan {
  source: string;
  categories: PlanCategory[];
  transactions: PlanTransaction[];
  budgets: PlanBudget[];
  /** Human-readable reasons for rows that could not be read. */
  skipped: string[];
}

export interface ImportResult {
  categoriesCreated: number;
  transactionsAdded: number;
  transactionsUpdated: number;
  duplicatesSkipped: number;
  budgetsSaved: number;
  rowsSkipped: string[];
}

export const nameKey = (kind: TxnType, name: string) => `${kind}|${name.trim().toLowerCase()}`;

export function summarizeResult(r: ImportResult): string {
  const lines = [
    r.transactionsAdded || !r.budgetsSaved ? `${r.transactionsAdded} transaction(s) added` : '',
    r.transactionsUpdated ? `${r.transactionsUpdated} updated` : '',
    r.duplicatesSkipped ? `${r.duplicatesSkipped} duplicate(s) skipped` : '',
    r.budgetsSaved ? `${r.budgetsSaved} budget value(s) saved` : '',
    r.categoriesCreated ? `${r.categoriesCreated} new categor${r.categoriesCreated === 1 ? 'y' : 'ies'} created` : '',
    r.rowsSkipped.length ? `${r.rowsSkipped.length} row(s) could not be read:\n• ${r.rowsSkipped.slice(0, 5).join('\n• ')}${r.rowsSkipped.length > 5 ? '\n• …' : ''}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Accepts 2026-11-05, 05-11-2026, 5/11/2026, 05.11.2026, a JS Date, or an Excel serial number. */
export function parseFlexibleDate(input: unknown): string | null {
  const pad = (n: number | string) => String(n).padStart(2, '0');
  const valid = (y: number, m: number, d: number) => {
    const dt = new Date(y, m - 1, d);
    return y > 1900 && y < 2200 && dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  };
  if (input instanceof Date && !isNaN(input.getTime())) {
    // Excel dates arrive as midnight local time; nudge by 12h to dodge timezone rounding.
    const d = new Date(input.getTime() + 12 * 3600 * 1000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (typeof input === 'number' && input > 20000 && input < 80000) {
    // Excel serial date (days since 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(input) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(input ?? '').trim();
  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m && valid(+m[1], +m[2], +m[3])) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/); // Indian style: day first
  if (m && valid(+m[3], +m[2], +m[1])) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}

/** Accepts 1250, "1,250.50", "₹ 1250". Returns null for anything else or ≤ 0. */
export function parseImportAmount(input: unknown): number | null {
  const n = typeof input === 'number' ? input : Number(String(input ?? '').replace(/[₹,\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export function parseType(input: unknown): TxnType | null {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith('inc')) return 'income';
  if (s.startsWith('inv')) return 'investment';
  if (s.startsWith('exp')) return 'expense';
  return null;
}
