/**
 * Reading and writing data. Screens never write SQL directly — they go through
 * the functions in this file (via the DataProvider in src/state/data.tsx).
 */
import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { deleteLocalReceipt, type SavedReceipt } from '@/lib/receipts';
import type { Budget, Category, Prefs, Transaction, TxnType } from '@/lib/types';

const now = () => new Date().toISOString();

// ---------- Reading ----------

export async function loadCategories(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<{
    id: string; name: string; kind: TxnType; icon: string; color: string; sort_order: number;
  }>('SELECT id, name, kind, icon, color, sort_order FROM categories WHERE deleted = 0 ORDER BY sort_order, name');
  return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, icon: r.icon, color: r.color, sortOrder: r.sort_order }));
}

export async function loadTransactions(db: SQLiteDatabase): Promise<Transaction[]> {
  const rows = await db.getAllAsync<{
    id: string; type: TxnType; amount: number; category_id: string; date: string; note: string;
    created_at: string; updated_at: string; receipt_path: string; receipt_local: string | null;
  }>(
    `SELECT id, type, amount, category_id, date, note, created_at, updated_at, receipt_path, receipt_local
       FROM transactions WHERE deleted = 0 ORDER BY date DESC, created_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id, type: r.type, amount: r.amount, categoryId: r.category_id, date: r.date, note: r.note,
    createdAt: r.created_at, updatedAt: r.updated_at, receiptPath: r.receipt_path, receiptLocal: r.receipt_local,
  }));
}

export async function loadBudgets(db: SQLiteDatabase): Promise<Budget[]> {
  const rows = await db.getAllAsync<{ category_id: string; month: string; amount: number; remark: string }>(
    'SELECT category_id, month, amount, remark FROM budgets',
  );
  return rows.map((r) => ({ categoryId: r.category_id, month: r.month, amount: r.amount, remark: r.remark }));
}

export async function loadPrefs(db: SQLiteDatabase): Promise<Partial<Prefs>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM prefs');
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      // ignore a corrupt value; the default will be used
    }
  }
  return out as Partial<Prefs>;
}

// ---------- Writing ----------

export type TransactionInput = Pick<Transaction, 'type' | 'amount' | 'categoryId' | 'date' | 'note'> & {
  id?: string;
  /** undefined = keep the current photo · null = remove it · object = new photo */
  receipt?: SavedReceipt | null;
};

export async function upsertTransaction(db: SQLiteDatabase, input: TransactionInput): Promise<string> {
  const ts = now();
  const id = input.id ?? randomUUID();
  if (input.id) {
    await db.runAsync(
      `UPDATE transactions SET type = ?, amount = ?, category_id = ?, date = ?, note = ?, updated_at = ?, synced = 0 WHERE id = ?`,
      input.type, input.amount, input.categoryId, input.date, input.note, ts, id,
    );
  } else {
    await db.runAsync(
      `INSERT INTO transactions (id, type, amount, category_id, date, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id, input.type, input.amount, input.categoryId, input.date, input.note, ts, ts,
    );
  }
  if (input.receipt !== undefined) {
    const old = await db.getFirstAsync<{ receipt_local: string | null }>('SELECT receipt_local FROM transactions WHERE id = ?', id);
    if (old?.receipt_local && old.receipt_local !== input.receipt?.localRef) deleteLocalReceipt(old.receipt_local);
    await db.runAsync(
      'UPDATE transactions SET receipt_path = ?, receipt_local = ?, receipt_uploaded = 0, updated_at = ?, synced = 0 WHERE id = ?',
      input.receipt ? `${id}/${input.receipt.fileName}` : '', input.receipt?.localRef ?? null, ts, id,
    );
  }
  return id;
}

export async function deleteTransaction(db: SQLiteDatabase, id: string) {
  const old = await db.getFirstAsync<{ receipt_local: string | null }>('SELECT receipt_local FROM transactions WHERE id = ?', id);
  deleteLocalReceipt(old?.receipt_local);
  await db.runAsync('UPDATE transactions SET deleted = 1, receipt_local = NULL, updated_at = ?, synced = 0 WHERE id = ?', now(), id);
}

/** Remembers where a downloaded photo was saved (doesn't count as an edit). */
export async function setReceiptLocal(db: SQLiteDatabase, id: string, receiptPath: string, localRef: string) {
  await db.runAsync('UPDATE transactions SET receipt_local = ? WHERE id = ? AND receipt_path = ?', localRef, id, receiptPath);
}

export type CategoryInput = Pick<Category, 'name' | 'kind' | 'icon' | 'color'> & { id?: string };

export async function upsertCategory(db: SQLiteDatabase, input: CategoryInput): Promise<string> {
  const ts = now();
  if (input.id) {
    await db.runAsync(
      'UPDATE categories SET name = ?, kind = ?, icon = ?, color = ?, updated_at = ?, synced = 0 WHERE id = ?',
      input.name, input.kind, input.icon, input.color, ts, input.id,
    );
    // Keep existing transactions consistent with the category's kind.
    await db.runAsync(
      'UPDATE transactions SET type = ?, updated_at = ?, synced = 0 WHERE category_id = ? AND type != ?',
      input.kind, ts, input.id, input.kind,
    );
    return input.id;
  }
  const id = randomUUID();
  const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM categories');
  await db.runAsync(
    'INSERT INTO categories (id, name, kind, icon, color, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, input.name, input.kind, input.icon, input.color, (max?.m ?? 0) + 1, ts,
  );
  return id;
}

/** Hides a category. Its old transactions stay and show as "Uncategorised". */
export async function deleteCategory(db: SQLiteDatabase, id: string) {
  await db.runAsync('UPDATE categories SET deleted = 1, updated_at = ?, synced = 0 WHERE id = ?', now(), id);
}

export async function setBudget(db: SQLiteDatabase, b: Budget) {
  await db.runAsync(
    `INSERT INTO budgets (category_id, month, amount, remark, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (category_id, month) DO UPDATE SET amount = excluded.amount, remark = excluded.remark,
       updated_at = excluded.updated_at, synced = 0`,
    b.categoryId, b.month, b.amount, b.remark, now(),
  );
}

/** Copies every budget from one month to another (overwrites the target). */
export async function copyBudgets(db: SQLiteDatabase, fromMonth: string, toMonth: string): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO budgets (category_id, month, amount, remark, updated_at)
       SELECT category_id, ?, amount, remark, ? FROM budgets WHERE month = ?
     ON CONFLICT (category_id, month) DO UPDATE SET amount = excluded.amount, remark = excluded.remark,
       updated_at = excluded.updated_at, synced = 0`,
    toMonth, now(), fromMonth,
  );
  return res.changes;
}

export async function setPref<K extends keyof Prefs>(db: SQLiteDatabase, key: K, value: Prefs[K]) {
  await db.runAsync(
    'INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key, JSON.stringify(value),
  );
}
