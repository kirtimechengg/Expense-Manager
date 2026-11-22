/**
 * DataProvider loads everything from SQLite into memory once, and gives screens
 * simple functions like `saveTransaction(...)`. After every write it re-reads the
 * database, so all screens update automatically.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { loadDemoData } from '@/db/demo';
import { applyImport } from '@/db/import';
import * as repo from '@/db/repo';
import type { ImportPlan, ImportResult } from '@/lib/import-plan';
import { budgetKey } from '@/lib/stats';
import type { Budget, Category, Prefs, Transaction } from '@/lib/types';

const DEFAULT_PREFS: Prefs = { privacyMode: false, theme: 'system' };

interface DataState {
  ready: boolean;
  categories: Category[];
  categoryById: Map<string, Category>;
  transactions: Transaction[];
  budgets: Map<string, Budget>;
  prefs: Prefs;
  saveTransaction: (t: repo.TransactionInput) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  saveCategory: (c: repo.CategoryInput) => Promise<string>;
  removeCategory: (id: string) => Promise<void>;
  saveBudget: (b: Budget) => Promise<void>;
  copyBudgets: (fromMonth: string, toMonth: string) => Promise<number>;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => Promise<void>;
  /** Adds/merges data from a backup or Excel file. Never deletes anything. */
  importPlan: (plan: ImportPlan) => Promise<ImportResult>;
  /** Development helper: adds 6 months of sample data. */
  loadDemo: () => Promise<void>;
}

const DataContext = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgetList, setBudgetList] = useState<Budget[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  const reload = useCallback(async () => {
    const [c, t, b, p] = await Promise.all([
      repo.loadCategories(db),
      repo.loadTransactions(db),
      repo.loadBudgets(db),
      repo.loadPrefs(db),
    ]);
    return () => {
      setCategories(c);
      setTransactions(t);
      setBudgetList(b);
      setPrefs({ ...DEFAULT_PREFS, ...p });
      setReady(true);
    };
  }, [db]);

  const refresh = useCallback(async () => (await reload())(), [reload]);

  // Initial load when the app starts.
  useEffect(() => {
    let active = true;
    reload()
      .then((apply) => active && apply())
      .catch((e) => console.error('Failed to load data', e));
    return () => {
      active = false;
    };
  }, [reload]);

  const value = useMemo<DataState>(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const budgets = new Map(
      budgetList.filter((b) => categoryById.has(b.categoryId)).map((b) => [budgetKey(b.month, b.categoryId), b]),
    );
    return {
      ready,
      categories,
      categoryById,
      transactions,
      budgets,
      prefs,
      saveTransaction: async (t) => {
        await repo.upsertTransaction(db, t);
        await refresh();
      },
      removeTransaction: async (id) => {
        await repo.deleteTransaction(db, id);
        await refresh();
      },
      saveCategory: async (c) => {
        const id = await repo.upsertCategory(db, c);
        await refresh();
        return id;
      },
      removeCategory: async (id) => {
        await repo.deleteCategory(db, id);
        await refresh();
      },
      saveBudget: async (b) => {
        await repo.setBudget(db, b);
        await refresh();
      },
      copyBudgets: async (from, to) => {
        const n = await repo.copyBudgets(db, from, to);
        await refresh();
        return n;
      },
      setPref: async (key, v) => {
        setPrefs((p) => ({ ...p, [key]: v })); // instant UI feedback
        await repo.setPref(db, key, v);
      },
      importPlan: async (plan) => {
        const result = await applyImport(db, plan);
        await refresh();
        return result;
      },
      loadDemo: async () => {
        await loadDemoData(db, categories);
        await refresh();
      },
    };
  }, [db, refresh, ready, categories, transactions, budgetList, prefs]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
