/**
 * Local SQLite database: creating tables and upgrading them between app versions.
 *
 * Every row has `updated_at` and a `deleted` flag (we "soft delete").
 * That is what makes cloud sync with Supabase possible later.
 */
import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CATEGORIES } from '@/lib/defaults';

export const DATABASE_NAME = 'wallet.db';
const LATEST_VERSION = 1;

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version > LATEST_VERSION) {
    throw new Error('This database was created by a newer version of the app.');
  }
  if (version === LATEST_VERSION) return;

  await db.withTransactionAsync(async () => {
    if (version < 1) {
      await db.execAsync(`
        CREATE TABLE categories (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('expense','income','investment')),
          icon TEXT NOT NULL,
          color TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL,
          deleted INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE transactions (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('expense','income','investment')),
          amount REAL NOT NULL,
          category_id TEXT NOT NULL,
          date TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX idx_transactions_date ON transactions(date);
        CREATE TABLE budgets (
          category_id TEXT NOT NULL,
          month TEXT NOT NULL,
          amount REAL NOT NULL DEFAULT 0,
          remark TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL,
          PRIMARY KEY (category_id, month)
        );
        CREATE TABLE prefs (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);

      const now = new Date().toISOString();
      for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
        await db.runAsync(
          'INSERT INTO categories (id, name, kind, icon, color, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          randomUUID(), c.name, c.kind, c.icon, c.color, i, now,
        );
      }
    }
    // Future schema changes go here:  if (version < 2) { ... }
    await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
  });
}
