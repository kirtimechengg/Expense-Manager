/**
 * The month the user is looking at. Shared by all tabs, so switching to
 * "October" on Home also shows October on Transactions and Insights.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { addMonths, currentMonth, type MonthRef } from '@/lib/dates';

interface PeriodState {
  period: MonthRef;
  setPeriod: (ref: MonthRef) => void;
  shift: (deltaMonths: number) => void;
  goToToday: () => void;
  isCurrent: boolean;
}

const PeriodContext = createContext<PeriodState | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<MonthRef>(currentMonth);
  const value = useMemo<PeriodState>(() => {
    const now = currentMonth();
    return {
      period,
      setPeriod,
      shift: (d) => setPeriod((p) => addMonths(p, d)),
      goToToday: () => setPeriod(currentMonth()),
      isCurrent: now.year === period.year && now.month === period.month,
    };
  }, [period]);
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodState {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error('usePeriod must be used inside <PeriodProvider>');
  return ctx;
}
