/**
 * Applies an ImportPlan to the database inside one transaction (all-or-nothing).
 * It never deletes anything — imports only add or update.
 */
import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { nameKey, type ImportPlan, type ImportResult } from '@/lib/import-plan';
import type { TxnType } from '@/lib/types';
import { CATEGORY_COLORS } from '@/theme/colors';

const DEFAULT_ICON: Record<TxnType, string> = { expense: 'pricetag', income: 'cash', investment: 'trending-up' };

export async function applyImport(db: SQLiteDatabase, plan: ImportPlan): Promise<ImportResult> {
  const result: ImportResult = {
    categoriesCreated: 0, transactionsAdded: 0, transactionsUpdated: 0, duplicatesSkipped: 0, budgetsSaved: 0,
    rowsSkipped: [...plan.skipped],
  };
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // ---- 1. Categories: reuse by id, then by name + type; otherwise create.
    const existing = await db.getAllAsync<{ id: string; name: string; kind: TxnType; deleted: number }>(
      'SELECT id, name, kind, deleted FROM categories',
    );
    const byId = new Map(existing.map((c) => [c.id, c]));
    const byName = new Map(existing.filter((c) => !c.deleted).map((c) => [nameKey(c.kind, c.name), c.id]));
    const resolved = new Map<string, string>(); // plan key -> real id
    const kindOf = new Map<string, TxnType>(existing.map((c) => [c.id, c.kind])); // real id -> kind
    let sortOrder = (await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM categories'))?.m ?? 0;

    for (const c of plan.categories) {
      const sameId = c.id ? byId.get(c.id) : undefined;
      if (sameId && !sameId.deleted) {
        resolved.set(c.key, sameId.id);
        continue;
      }
      const sameName = byName.get(nameKey(c.kind, c.name));
      if (sameName) {
        resolved.set(c.key, sameName);
        continue;
      }
      const id = c.id && !byId.has(c.id) ? c.id : randomUUID();
      const color = c.color || CATEGORY_COLORS[(sortOrder + 1) % CATEGORY_COLORS.length];
      await db.runAsync(
        'INSERT INTO categories (id, name, kind, icon, color, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id, c.name, c.kind, c.icon || DEFAULT_ICON[c.kind], color, ++sortOrder, now,
      );
      byName.set(nameKey(c.kind, c.name), id);
      kindOf.set(id, c.kind);
      resolved.set(c.key, id);
      result.categoriesCreated++;
    }

    // ---- 2. Transactions: same id → update if the backup copy is newer; same content → skip as duplicate.
    const txns = await db.getAllAsync<{ id: string; type: string; amount: number; category_id: string; date: string; note: string; updated_at: string }>(
      'SELECT id, type, amount, category_id, date, note, updated_at FROM transactions WHERE deleted = 0',
    );
    const txnById = new Map(txns.map((t) => [t.id, t]));
    const fingerprint = (t: { date: string; amount: number; category_id: string; note: string }) =>
      `${t.date}|${t.amount.toFixed(2)}|${t.category_id}|${t.note.trim().toLowerCase()}`;
    const seen = new Set(txns.map(fingerprint));

    for (const t of plan.transactions) {
      const categoryId = resolved.get(t.categoryKey);
      if (!categoryId) {
        result.rowsSkipped.push(`${t.date} ${t.amount}: unknown category`);
        continue;
      }
      // A transaction's type always follows its category's type.
      const type = kindOf.get(categoryId) ?? t.type;
      const row = { date: t.date, amount: t.amount, category_id: categoryId, note: t.note };
      const old = t.id ? txnById.get(t.id) : undefined;
      if (old) {
        if (t.updatedAt && t.updatedAt > old.updated_at) {
          await db.runAsync(
            'UPDATE transactions SET type = ?, amount = ?, category_id = ?, date = ?, note = ?, updated_at = ?, synced = 0 WHERE id = ?',
            type, t.amount, categoryId, t.date, t.note, t.updatedAt, old.id,
          );
          result.transactionsUpdated++;
        } else {
          result.duplicatesSkipped++;
        }
        continue;
      }
      const fp = fingerprint(row);
      if (seen.has(fp)) {
        result.duplicatesSkipped++;
        continue;
      }
      seen.add(fp);
      // A deleted row may still hold this id, so only reuse ids that are completely free.
      const idFree = t.id ? !(await db.getFirstAsync('SELECT 1 FROM transactions WHERE id = ?', t.id)) : false;
      await db.runAsync(
        `INSERT INTO transactions (id, type, amount, category_id, date, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        idFree && t.id ? t.id : randomUUID(), type, t.amount, categoryId, t.date, t.note,
        t.createdAt || now, t.updatedAt || now,
      );
      result.transactionsAdded++;
    }

    // ---- 3. Budgets: upsert.
    for (const b of plan.budgets) {
      const categoryId = resolved.get(b.categoryKey);
      if (!categoryId) continue;
      await db.runAsync(
        `INSERT INTO budgets (category_id, month, amount, remark, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (category_id, month) DO UPDATE SET amount = excluded.amount, remark = excluded.remark,
           updated_at = excluded.updated_at, synced = 0`,
        categoryId, b.month, b.amount, b.remark, now,
      );
      result.budgetsSaved++;
    }
  });

  return result;
}
