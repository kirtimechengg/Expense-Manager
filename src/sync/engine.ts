/**
 * Two-way sync between this phone's SQLite database and the household's Supabase tables.
 *
 *  1. PULL  — download rows changed on the server since last time (per table "cursor").
 *             A downloaded row replaces the local one unless the local copy has newer,
 *             not-yet-uploaded changes ("last writer wins" by updated_at).
 *  2. MERGE — only the first time on a household: categories that exist on both sides with the
 *             same name (e.g. the default "Food & Dining" on two phones) are merged into one.
 *  3. PUSH  — upload rows marked `synced = 0`, then mark them synced.
 *
 * The server applies the same "last writer wins" rule (see wallet_sync_stamp in the SQL),
 * so two phones editing at the same time end up with the same result.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';

import { downloadReceipt, receiptBytes, receiptExists } from '@/lib/receipts';

const PAGE = 1000;
const PUSH_CHUNK = 500;

export interface SyncStats {
  pulled: number;
  pushed: number;
  merged: number;
  receiptsFailed: number;
}

// ---------- small sync_state helpers ----------

async function getState(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', key);
  return row?.value ?? null;
}
async function setState(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key, value,
  );
}

/** Server timestamps look like "2026-11-01T10:00:00+00:00"; local ones are "2026-11-01T10:00:00.000Z". */
const iso = (ts: string) => new Date(ts).toISOString();
/** Same, but never throws: imported data may contain odd timestamps. */
const safeIso = (v: unknown) => {
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

// ---------- table descriptions ----------

type Row = Record<string, unknown>;

interface TableSpec {
  name: 'categories' | 'transactions' | 'budgets';
  /** Local SQLite → server row */
  toRemote: (r: Row, householdId: string) => Row;
  /** Server row → values for the local upsert statement */
  toLocal: (r: Row) => (string | number)[];
  upsertSql: string;
  onConflict: string;
  /** Columns that identify a local row (for "mark as synced") */
  keyColumns: string[];
}

const TABLES: TableSpec[] = [
  {
    name: 'categories',
    onConflict: 'household_id,id',
    keyColumns: ['id'],
    toRemote: (r, hid) => ({
      household_id: hid, id: r.id, name: r.name, kind: r.kind, icon: r.icon, color: r.color,
      sort_order: r.sort_order, updated_at: safeIso(r.updated_at), deleted: !!r.deleted,
    }),
    toLocal: (r) => [
      String(r.id), String(r.name), String(r.kind), String(r.icon), String(r.color), Number(r.sort_order),
      iso(String(r.updated_at)), r.deleted ? 1 : 0,
    ],
    upsertSql: `INSERT INTO categories (id, name, kind, icon, color, sort_order, updated_at, deleted, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT (id) DO UPDATE SET name = excluded.name, kind = excluded.kind, icon = excluded.icon,
        color = excluded.color, sort_order = excluded.sort_order, updated_at = excluded.updated_at,
        deleted = excluded.deleted, synced = 1
      WHERE categories.synced = 1 OR excluded.updated_at >= categories.updated_at`,
  },
  {
    name: 'transactions',
    onConflict: 'household_id,id',
    keyColumns: ['id'],
    toRemote: (r, hid) => ({
      household_id: hid, id: r.id, type: r.type, amount: r.amount, category_id: r.category_id, date: r.date,
      note: r.note, created_at: safeIso(r.created_at), updated_at: safeIso(r.updated_at), deleted: !!r.deleted,
      receipt_path: r.receipt_path ?? '',
    }),
    toLocal: (r) => [
      String(r.id), String(r.type), Number(r.amount), String(r.category_id), String(r.date).slice(0, 10), String(r.note ?? ''),
      iso(String(r.created_at)), iso(String(r.updated_at)), r.deleted ? 1 : 0, String(r.receipt_path ?? ''),
    ],
    // A photo that came from the server counts as uploaded. If the photo changed, forget the old local copy
    // (the new one is downloaded when someone opens it).
    upsertSql: `INSERT INTO transactions (id, type, amount, category_id, date, note, created_at, updated_at, deleted, receipt_path, receipt_uploaded, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
      ON CONFLICT (id) DO UPDATE SET type = excluded.type, amount = excluded.amount, category_id = excluded.category_id,
        date = excluded.date, note = excluded.note, updated_at = excluded.updated_at, deleted = excluded.deleted,
        receipt_local = CASE WHEN excluded.receipt_path = transactions.receipt_path THEN transactions.receipt_local ELSE NULL END,
        receipt_uploaded = CASE WHEN excluded.receipt_path = transactions.receipt_path THEN transactions.receipt_uploaded ELSE 1 END,
        receipt_path = excluded.receipt_path, synced = 1
      WHERE transactions.synced = 1 OR excluded.updated_at >= transactions.updated_at`,
  },
  {
    name: 'budgets',
    onConflict: 'household_id,category_id,month',
    keyColumns: ['category_id', 'month'],
    toRemote: (r, hid) => ({
      household_id: hid, category_id: r.category_id, month: r.month, amount: r.amount, remark: r.remark, updated_at: safeIso(r.updated_at),
    }),
    toLocal: (r) => [String(r.category_id), String(r.month), Number(r.amount), String(r.remark ?? ''), iso(String(r.updated_at))],
    upsertSql: `INSERT INTO budgets (category_id, month, amount, remark, updated_at, synced) VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT (category_id, month) DO UPDATE SET amount = excluded.amount, remark = excluded.remark,
        updated_at = excluded.updated_at, synced = 1
      WHERE budgets.synced = 1 OR excluded.updated_at >= budgets.updated_at`,
  },
];

// ---------- pull ----------

async function pullTable(db: SQLiteDatabase, client: SupabaseClient, hid: string, t: TableSpec, seenIds?: Set<string>) {
  const cursorKey = `cursor:${hid}:${t.name}`;
  let cursor = await getState(db, cursorKey);
  let total = 0;
  for (let guard = 0; guard < 500; guard++) {
    let q = client.from(t.name).select('*').eq('household_id', hid).order('server_updated_at', { ascending: true }).limit(PAGE);
    // gte (not gt): rows with exactly the cursor time are fetched again — harmless, nothing is missed.
    if (cursor) q = q.gte('server_updated_at', cursor);
    const { data, error } = await q;
    if (error) throw new Error(`Download ${t.name}: ${error.message}`);
    const rows = (data ?? []) as Row[];
    if (rows.length) {
      await db.withTransactionAsync(async () => {
        for (const r of rows) {
          await db.runAsync(t.upsertSql, ...t.toLocal(r));
          if (seenIds && r.id) seenIds.add(String(r.id));
        }
      });
      total += rows.length;
      const last = String(rows[rows.length - 1].server_updated_at);
      const stalled = last === cursor && rows.length === PAGE;
      cursor = last;
      await setState(db, cursorKey, cursor);
      if (stalled) break; // can't happen with clock_timestamp(), but never loop forever
    }
    if (rows.length < PAGE) break;
  }
  return total;
}

// ---------- first-time merge of same-named categories ----------

async function mergeDuplicateCategories(db: SQLiteDatabase, remoteIds: Set<string>): Promise<number> {
  const cats = await db.getAllAsync<{ id: string; name: string; kind: string }>(
    'SELECT id, name, kind FROM categories WHERE deleted = 0',
  );
  const remoteByName = new Map<string, string>();
  for (const c of cats) if (remoteIds.has(c.id)) remoteByName.set(`${c.kind}|${c.name.trim().toLowerCase()}`, c.id);

  let merged = 0;
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const c of cats) {
      if (remoteIds.has(c.id)) continue;
      const target = remoteByName.get(`${c.kind}|${c.name.trim().toLowerCase()}`);
      if (!target) continue;
      await db.runAsync('UPDATE transactions SET category_id = ?, updated_at = ?, synced = 0 WHERE category_id = ?', target, now, c.id);
      // Keep the household's budget if both have one for the same month.
      await db.runAsync(
        `INSERT OR IGNORE INTO budgets (category_id, month, amount, remark, updated_at, synced)
         SELECT ?, month, amount, remark, ?, 0 FROM budgets WHERE category_id = ?`,
        target, now, c.id,
      );
      await db.runAsync('DELETE FROM budgets WHERE category_id = ?', c.id);
      await db.runAsync('DELETE FROM categories WHERE id = ?', c.id); // never uploaded, so a real delete is fine
      merged++;
    }
  });
  return merged;
}

// ---------- push ----------

async function pushTable(db: SQLiteDatabase, client: SupabaseClient, hid: string, t: TableSpec) {
  const rows = await db.getAllAsync<Row>(`SELECT * FROM ${t.name} WHERE synced = 0`);
  for (let i = 0; i < rows.length; i += PUSH_CHUNK) {
    const chunk = rows.slice(i, i + PUSH_CHUNK);
    const { error } = await client
      .from(t.name)
      .upsert(chunk.map((r) => t.toRemote(r, hid)), { onConflict: t.onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`Upload ${t.name}: ${error.message}`);
    // Only mark rows that weren't edited again while uploading.
    const where = t.keyColumns.map((c) => `${c} = ?`).join(' AND ');
    await db.withTransactionAsync(async () => {
      for (const r of chunk) {
        await db.runAsync(
          `UPDATE ${t.name} SET synced = 1 WHERE ${where} AND updated_at = ?`,
          ...t.keyColumns.map((c) => r[c] as string), r.updated_at as string,
        );
      }
    });
  }
  return rows.length;
}

// ---------- receipt photos ----------

export const RECEIPT_BUCKET = 'receipts';

/** Uploads photos that are on this phone but not yet in the cloud. One failing photo doesn't stop the sync. */
async function uploadReceipts(db: SQLiteDatabase, client: SupabaseClient, hid: string): Promise<number> {
  const rows = await db.getAllAsync<{ id: string; receipt_path: string; receipt_local: string | null }>(
    `SELECT id, receipt_path, receipt_local FROM transactions
      WHERE deleted = 0 AND receipt_path != '' AND receipt_uploaded = 0 AND receipt_local IS NOT NULL`,
  );
  let failed = 0;
  for (const r of rows) {
    try {
      if (!receiptExists(r.receipt_local)) continue;
      const bytes = await receiptBytes(r.receipt_local!);
      const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const { error } = await client.storage
        .from(RECEIPT_BUCKET)
        .upload(`${hid}/${r.receipt_path}`, body, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      await db.runAsync('UPDATE transactions SET receipt_uploaded = 1 WHERE id = ? AND receipt_path = ?', r.id, r.receipt_path);
    } catch (e) {
      failed++;
      console.warn('Receipt upload failed', r.receipt_path, e);
    }
  }
  return failed;
}

/** Fetches a family member's photo the first time it's opened on this phone. Returns its localRef. */
export async function fetchReceipt(
  db: SQLiteDatabase, client: SupabaseClient, hid: string, txnId: string, receiptPath: string,
): Promise<string> {
  const { data, error } = await client.storage.from(RECEIPT_BUCKET).createSignedUrl(`${hid}/${receiptPath}`, 120);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Photo not found');
  const fileName = receiptPath.split('/').pop() || `${txnId}.jpg`;
  const localRef = await downloadReceipt(data.signedUrl, fileName);
  await db.runAsync('UPDATE transactions SET receipt_local = ? WHERE id = ? AND receipt_path = ?', localRef, txnId, receiptPath);
  return localRef;
}

// ---------- public API ----------

export async function syncHousehold(db: SQLiteDatabase, client: SupabaseClient, householdId: string): Promise<SyncStats> {
  const mergedKey = `merged:${householdId}`;
  const firstTime = !(await getState(db, mergedKey));
  const remoteCategoryIds = firstTime ? new Set<string>() : undefined;

  let pulled = 0;
  for (const t of TABLES) pulled += await pullTable(db, client, householdId, t, t.name === 'categories' ? remoteCategoryIds : undefined);

  let merged = 0;
  if (firstTime && remoteCategoryIds) {
    merged = await mergeDuplicateCategories(db, remoteCategoryIds);
    await setState(db, mergedKey, new Date().toISOString());
  }

  // Photos first, so a family member never sees a transaction whose photo isn't there yet.
  const receiptsFailed = await uploadReceipts(db, client, householdId);

  let pushed = 0;
  for (const t of TABLES) pushed += await pushTable(db, client, householdId, t);

  await setState(db, `lastSync:${householdId}`, new Date().toISOString());
  return { pulled, pushed, merged, receiptsFailed };
}

export async function pendingChanges(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM categories WHERE synced = 0)
          + (SELECT COUNT(*) FROM transactions WHERE synced = 0)
          + (SELECT COUNT(*) FROM budgets WHERE synced = 0) AS n`,
  );
  return row?.n ?? 0;
}

export async function lastSyncedAt(db: SQLiteDatabase, householdId: string): Promise<string | null> {
  return getState(db, `lastSync:${householdId}`);
}

/** After leaving a household / signing out: keep the data, but treat everything as "not uploaded". */
export async function resetSyncState(db: SQLiteDatabase) {
  await db.execAsync(`
    DELETE FROM sync_state;
    UPDATE categories SET synced = 0;
    UPDATE transactions SET synced = 0, receipt_uploaded = 0;
    UPDATE budgets SET synced = 0;
  `);
}
