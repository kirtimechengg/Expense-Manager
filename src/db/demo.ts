/**
 * Fills the app with ~6 months of realistic sample data so you can try every screen.
 * Only offered in development builds (Settings → Developer).
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { addMonths, currentMonth, daysInMonth, monthKey, todayKey } from '@/lib/dates';
import type { Category } from '@/lib/types';
import { setBudget, upsertTransaction } from './repo';

type Plan = { name: string; min: number; max: number; perMonth: number; notes?: string[] };

const EXPENSES: Plan[] = [
  { name: 'Food & Dining', min: 150, max: 1800, perMonth: 9, notes: ['Groceries', 'Swiggy', 'Dinner out', 'Vegetables', 'Cafe'] },
  { name: 'Transportation', min: 100, max: 2500, perMonth: 5, notes: ['Petrol', 'Uber', 'Metro card'] },
  { name: 'Utilities', min: 400, max: 3200, perMonth: 3, notes: ['Electricity', 'Internet', 'Mobile recharge'] },
  { name: 'Shopping', min: 500, max: 6000, perMonth: 2, notes: ['Amazon', 'Clothes'] },
  { name: 'Entertainment', min: 200, max: 1500, perMonth: 2, notes: ['Movie', 'Netflix'] },
  { name: 'Health', min: 300, max: 2500, perMonth: 1, notes: ['Pharmacy', 'Doctor visit'] },
  { name: 'School', min: 4000, max: 9000, perMonth: 1, notes: ['School fees'] },
];
const INVESTMENTS: Plan[] = [
  { name: 'MF', min: 10000, max: 10000, perMonth: 1, notes: ['SIP'] },
  { name: 'PPF', min: 5000, max: 5000, perMonth: 1 },
  { name: 'Equity', min: 2000, max: 12000, perMonth: 1, notes: ['Stocks'] },
];

export async function loadDemoData(db: SQLiteDatabase, categories: Category[]) {
  const byName = new Map(categories.map((c) => [c.name, c]));
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const between = (a: number, b: number) => Math.round((a + rand() * (b - a)) / 10) * 10;
  const today = todayKey();

  await db.withTransactionAsync(async () => {
    for (let i = 5; i >= 0; i--) {
      const ref = addMonths(currentMonth(), -i);
      const days = daysInMonth(ref);
      const date = (d: number) => `${monthKey(ref)}-${String(Math.min(d, days)).padStart(2, '0')}`;
      const add = async (catName: string, amount: number, d: number, note = '') => {
        const cat = byName.get(catName);
        const dt = date(d);
        if (!cat || dt > today) return;
        await upsertTransaction(db, { type: cat.kind, amount, categoryId: cat.id, date: dt, note });
      };

      await add('Salary', 85000, 1, 'Monthly salary');
      if (i % 3 === 0) await add('Interest', between(800, 2000), 28, 'Savings interest');
      if (i === 2) await add('Bonus', 25000, 15, 'Festival bonus');

      for (const p of [...EXPENSES, ...INVESTMENTS]) {
        for (let k = 0; k < p.perMonth; k++) {
          const note = p.notes ? p.notes[Math.floor(rand() * p.notes.length)] : '';
          await add(p.name, between(p.min, p.max), 1 + Math.floor(rand() * days), note);
        }
      }

      const budget: Record<string, number> = {
        'Food & Dining': 8000, Transportation: 5000, Utilities: 5000, Shopping: 6000, Entertainment: 2000, Health: 2000, School: 8000,
      };
      for (const [name, amount] of Object.entries(budget)) {
        const cat = byName.get(name);
        if (cat) await setBudget(db, { categoryId: cat.id, month: monthKey(ref), amount, remark: '' });
      }
    }
  });
}
