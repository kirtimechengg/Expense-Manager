/**
 * INSIGHTS — calendar heat-map, yearly cash flow, and category × month breakdown.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CalendarGrid } from '@/components/calendar-grid';
import { BarChart, Legend } from '@/components/charts';
import { MonthSwitcher } from '@/components/month-switcher';
import { Screen } from '@/components/screen';
import { AppText } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { Amount, Card, CategoryIcon, Segmented, SectionHeader } from '@/components/ui';
import { MONTHS_LONG, MONTHS_SHORT, friendlyDate, monthKey, toDateKey } from '@/lib/dates';
import { MASK, formatCompact } from '@/lib/money';
import { dailySpend, inMonth, inYear, monthlySeries, totalBudget, totalsOf } from '@/lib/stats';
import type { TxnType } from '@/lib/types';
import { useData } from '@/state/data';
import { usePeriod } from '@/state/period';
import { space, useTheme } from '@/theme';

type View_ = 'calendar' | 'cashflow' | 'categories';

export default function InsightsScreen() {
  const [view, setView] = useState<View_>('calendar');
  return (
    <Screen title="Insights">
      <Segmented<View_>
        value={view}
        onChange={setView}
        options={[
          { value: 'calendar', label: 'Calendar' },
          { value: 'cashflow', label: 'Cash flow' },
          { value: 'categories', label: 'Categories' },
        ]}
      />
      {view === 'calendar' ? <CalendarView /> : view === 'cashflow' ? <CashFlowView /> : <CategoryMatrix />}
    </Screen>
  );
}

function CalendarView() {
  const { transactions, prefs } = useData();
  const { period } = usePeriod();
  const now = new Date();
  const defaultDay =
    now.getFullYear() === period.year && now.getMonth() === period.month ? toDateKey(now) : `${monthKey(period)}-01`;
  const [selected, setSelected] = useState<string | null>(null);
  const day = selected?.startsWith(monthKey(period)) ? selected : defaultDay;

  const daily = dailySpend(transactions, period);
  const max = Math.max(...daily, 1);
  const monthTotal = daily.reduce((a, b) => a + b, 0);
  const activeDays = daily.filter((d) => d > 0).length;
  const dayTxns = transactions.filter((t) => t.date === day);

  return (
    <>
      <MonthSwitcher />
      <Card>
        <View style={styles.statsRow}>
          <Stat label="Spent" value={<Amount value={monthTotal} variant="heading" />} />
          <Stat label="Daily avg" value={<Amount value={monthTotal / daily.length} variant="heading" />} />
          <Stat label="Spend days" value={<AppText variant="heading">{activeDays}</AppText>} />
        </View>
      </Card>
      <Card>
        <CalendarGrid
          month={period}
          selected={day}
          onSelect={setSelected}
          intensity={daily.map((d) => d / max)}
          renderSub={(d) => (daily[d - 1] > 0 ? (prefs.privacyMode ? '•••' : formatCompact(daily[d - 1]).replace('₹', '')) : null)}
        />
      </Card>
      <Card>
        <SectionHeader title={friendlyDate(day)} />
        {dayTxns.length ? (
          dayTxns.map((t) => <TransactionRow key={t.id} txn={t} />)
        ) : (
          <AppText tone="muted">No transactions on this day.</AppText>
        )}
      </Card>
    </>
  );
}

function CashFlowView() {
  const { colors } = useTheme();
  const { transactions, budgets } = useData();
  const { period } = usePeriod();
  const series = monthlySeries(transactions, period.year);
  const year = totalsOf(inYear(transactions, period.year));
  const yearBudget = totalBudget(budgets, `${period.year}-`);

  return (
    <>
      <MonthSwitcher mode="year" />
      <Card>
        <View style={styles.statsRow}>
          <Stat label="Income" value={<Amount value={year.income} compact variant="heading" tone="income" />} />
          <Stat label="Invested" value={<Amount value={year.invested} compact variant="heading" tone="invest" />} />
          <Stat label="Spent" value={<Amount value={year.spent} compact variant="heading" tone="expense" />} />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.statsRow}>
          <Stat label="Net cash" value={<Amount value={year.cash} compact variant="heading" type="auto" />} />
          <Stat label="Budget" value={<Amount value={yearBudget} compact variant="heading" />} />
          <Stat
            label="Savings rate"
            value={<AppText variant="heading">{year.income ? Math.round(((year.income - year.spent) / year.income) * 100) : 0}%</AppText>}
          />
        </View>
      </Card>
      <Card>
        <SectionHeader title={`${period.year} by month`} />
        <BarChart
          height={150}
          data={series.map((m, i) => ({
            label: MONTHS_SHORT[i][0],
            values: [
              { value: m.income, color: colors.income },
              { value: m.invested, color: colors.invest },
              { value: m.spent, color: colors.expense },
            ],
          }))}
        />
        <View style={{ marginTop: space.md }}>
          <Legend
            items={[
              { label: 'Income', color: colors.income },
              { label: 'Invested', color: colors.invest },
              { label: 'Spent', color: colors.expense },
            ]}
          />
        </View>
      </Card>
      <Card padded={false}>
        <View style={[styles.tableRow, styles.tableHead, { borderColor: colors.border }]}>
          <AppText variant="label" tone="muted" style={styles.colMonth}>Month</AppText>
          <AppText variant="label" tone="muted" style={styles.colNum}>Budget</AppText>
          <AppText variant="label" tone="muted" style={styles.colNum}>Spent</AppText>
          <AppText variant="label" tone="muted" style={styles.colNum}>Net</AppText>
        </View>
        {series.map((m, i) => {
          const b = totalBudget(budgets, monthKey({ year: period.year, month: i }));
          const empty = !m.income && !m.spent && !m.invested && !b;
          return (
            <View key={i} style={[styles.tableRow, { borderColor: colors.border }]}>
              <AppText variant="bodyStrong" tone={empty ? 'faint' : 'default'} style={styles.colMonth}>{MONTHS_LONG[i].slice(0, 3)}</AppText>
              <Cell value={b} />
              <Cell value={m.spent} tone={b && m.spent > b ? 'expense' : undefined} />
              <Cell value={m.cash} type="auto" />
            </View>
          );
        })}
      </Card>
    </>
  );
}

function CategoryMatrix() {
  const { colors } = useTheme();
  const { transactions, categories } = useData();
  const { period } = usePeriod();
  const [kind, setKind] = useState<TxnType>('expense');
  const yearTxns = inYear(transactions, period.year).filter((t) => t.type === kind);

  const rows = categories
    .filter((c) => c.kind === kind)
    .map((c) => {
      const months = Array.from({ length: 12 }, (_, m) =>
        totalsOf(inMonth(yearTxns.filter((t) => t.categoryId === c.id), { year: period.year, month: m })),
      ).map((t) => t.income + t.invested + t.spent);
      return { c, months, total: months.reduce((a, b) => a + b, 0) };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const colTotals = Array.from({ length: 12 }, (_, m) => rows.reduce((s, r) => s + r.months[m], 0));

  return (
    <>
      <MonthSwitcher mode="year" />
      <Segmented<TxnType>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: 'Expenses' },
          { value: 'investment', label: 'Investments' },
          { value: 'income', label: 'Income' },
        ]}
      />
      <Card padded={false}>
        {rows.length === 0 ? (
          <View style={{ padding: space.lg }}>
            <AppText tone="muted">No data for {period.year}.</AppText>
          </View>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            {/* Fixed first column */}
            <View style={[styles.fixedCol, { borderColor: colors.border }]}>
              <View style={[styles.mCell, styles.tableHead, { borderColor: colors.border }]}>
                <AppText variant="label" tone="muted">Category</AppText>
              </View>
              {rows.map((r) => (
                <View key={r.c.id} style={[styles.mCell, styles.catCell, { borderColor: colors.border }]}>
                  <CategoryIcon icon={r.c.icon} color={r.c.color} size={24} />
                  <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>{r.c.name}</AppText>
                </View>
              ))}
              <View style={[styles.mCell, { borderColor: colors.border }]}>
                <AppText variant="bodyStrong">Total</AppText>
              </View>
            </View>
            {/* Scrollable months */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={{ flexDirection: 'row' }}>
                  {[...MONTHS_SHORT, 'Year'].map((m) => (
                    <View key={m} style={[styles.mCell, styles.numCell, styles.tableHead, { borderColor: colors.border }]}>
                      <AppText variant="label" tone="muted">{m}</AppText>
                    </View>
                  ))}
                </View>
                {rows.map((r) => (
                  <View key={r.c.id} style={{ flexDirection: 'row' }}>
                    {[...r.months, r.total].map((v, i) => (
                      <View key={i} style={[styles.mCell, styles.numCell, { borderColor: colors.border }]}>
                        <MatrixValue value={v} strong={i === 12} />
                      </View>
                    ))}
                  </View>
                ))}
                <View style={{ flexDirection: 'row' }}>
                  {[...colTotals, colTotals.reduce((a, b) => a + b, 0)].map((v, i) => (
                    <View key={i} style={[styles.mCell, styles.numCell, { borderColor: colors.border }]}>
                      <MatrixValue value={v} strong />
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Card>
    </>
  );
}

function MatrixValue({ value, strong }: { value: number; strong?: boolean }) {
  const { prefs } = useData();
  if (!value) return <AppText variant="caption" tone="faint">–</AppText>;
  return (
    <AppText variant="caption" tabular style={strong && { fontWeight: '700' }}>
      {prefs.privacyMode ? MASK : formatCompact(value)}
    </AppText>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="caption" tone="muted">{label}</AppText>
      {value}
    </View>
  );
}

function Cell({ value, tone, type }: { value: number; tone?: 'expense'; type?: 'auto' }) {
  if (!value) return <AppText variant="caption" tone="faint" style={styles.colNum}>–</AppText>;
  return <Amount value={value} compact variant="caption" tone={tone} type={type} style={[styles.colNum, { fontWeight: '600' }]} />;
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: space.md },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: space.md },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHead: { paddingVertical: 10 },
  colMonth: { flex: 1.1 },
  colNum: { flex: 1, textAlign: 'right' },
  fixedCol: { width: 130, borderRightWidth: StyleSheet.hairlineWidth },
  mCell: { height: 44, justifyContent: 'center', paddingHorizontal: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  catCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numCell: { width: 70, alignItems: 'flex-end' },
});
