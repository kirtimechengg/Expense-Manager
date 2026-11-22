/**
 * HOME — this month at a glance.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BarChart, Legend } from '@/components/charts';
import { MonthSwitcher } from '@/components/month-switcher';
import { Screen } from '@/components/screen';
import { AppText } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { Amount, Card, CategoryIcon, EmptyState, IconButton, ProgressBar, SectionHeader, type IconName } from '@/components/ui';
import { MONTHS_SHORT, greeting, monthKey } from '@/lib/dates';
import { byCategory, inMonth, recentMonths, totalBudget, totalsOf } from '@/lib/stats';
import { useData } from '@/state/data';
import { usePeriod } from '@/state/period';
import { radius, space, useTheme } from '@/theme';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { transactions, categoryById, budgets, prefs, setPref } = useData();
  const { period } = usePeriod();

  const monthTxns = inMonth(transactions, period);
  const totals = totalsOf(monthTxns);
  const budget = totalBudget(budgets, monthKey(period));
  const topCategories = byCategory(monthTxns, 'expense').slice(0, 5);
  const trend = recentMonths(transactions, period, 6);
  const recent = monthTxns.slice(0, 5);

  return (
    <Screen
      title="Wallet"
      subtitle={greeting()}
      right={
        <IconButton
          icon={prefs.privacyMode ? 'eye-off' : 'eye'}
          label="Toggle privacy mode"
          onPress={() => setPref('privacyMode', !prefs.privacyMode)}
        />
      }>
      <MonthSwitcher />

      {/* Hero card */}
      <LinearGradient colors={[colors.heroFrom, colors.heroTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <AppText variant="label" style={styles.heroLabel}>Cash left this month</AppText>
        <Amount value={totals.cash} variant="display" style={{ color: '#fff' }} />
        <View style={styles.heroRow}>
          <HeroStat icon="arrow-down" label="Income" value={totals.income} />
          <HeroStat icon="trending-up" label="Invested" value={totals.invested} />
          <HeroStat icon="arrow-up" label="Spent" value={totals.spent} />
        </View>
      </LinearGradient>

      {/* Budget */}
      <Card>
        <SectionHeader title="Budget" action={budget ? 'Edit' : 'Set up'} onAction={() => router.push('/budgets')} />
        {budget > 0 ? (
          <View style={{ gap: space.sm }}>
            <View style={styles.between}>
              <Amount value={totals.spent} variant="heading" />
              <AppText tone="muted" variant="caption">
                of <Amount value={budget} variant="caption" tone="muted" />
              </AppText>
            </View>
            <ProgressBar value={totals.spent / budget} height={10} />
            <AppText variant="caption" tone={totals.spent > budget ? 'expense' : 'muted'}>
              {totals.spent > budget ? 'Over budget by ' : 'Remaining '}
              <Amount value={Math.abs(budget - totals.spent)} variant="caption" tone={totals.spent > budget ? 'expense' : 'muted'} />
            </AppText>
          </View>
        ) : (
          <AppText tone="muted">Set monthly targets per category to track your spending.</AppText>
        )}
      </Card>

      {/* Top categories */}
      <Card>
        <SectionHeader title="Top spending" action="Insights" onAction={() => router.navigate('/insights')} />
        {topCategories.length === 0 ? (
          <AppText tone="muted">No expenses this month yet.</AppText>
        ) : (
          <View style={{ gap: space.md }}>
            {topCategories.map((c) => {
              const cat = categoryById.get(c.categoryId);
              return (
                <View key={c.categoryId} style={styles.catRow}>
                  <CategoryIcon icon={cat?.icon ?? 'help'} color={cat?.color ?? '#94A3B8'} size={36} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={styles.between}>
                      <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{cat?.name ?? 'Uncategorised'}</AppText>
                      <Amount value={c.total} variant="bodyStrong" />
                    </View>
                    <ProgressBar value={c.share} color={cat?.color} height={6} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {/* Trend */}
      <Card>
        <SectionHeader title="Last 6 months" />
        <BarChart
          data={trend.map((m) => ({
            label: MONTHS_SHORT[m.ref.month],
            highlight: m.ref.month === period.month && m.ref.year === period.year,
            values: [
              { value: m.totals.income, color: colors.income },
              { value: m.totals.spent, color: colors.expense },
            ],
          }))}
        />
        <View style={{ marginTop: space.md }}>
          <Legend items={[{ label: 'Income', color: colors.income }, { label: 'Spent', color: colors.expense }]} />
        </View>
      </Card>

      {/* Recent */}
      <Card>
        <SectionHeader title="Recent" action={recent.length ? 'See all' : undefined} onAction={() => router.navigate('/transactions')} />
        {recent.length === 0 ? (
          <EmptyState icon="receipt-outline" title="Nothing here yet" message="Tap + to add your first transaction for this month." />
        ) : (
          recent.map((t) => <TransactionRow key={t.id} txn={t} showDate />)
        )}
      </Card>
    </Screen>
  );
}

function HeroStat({ icon, label, value }: { icon: IconName; label: string; value: number }) {
  return (
    <View style={styles.heroStat}>
      <View style={styles.heroStatTop}>
        <Ionicons name={icon} size={12} color="rgba(255,255,255,0.85)" />
        <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{label}</AppText>
      </View>
      <Amount value={value} compact variant="bodyStrong" style={{ color: '#fff' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.xs },
  heroLabel: { color: 'rgba(255,255,255,0.75)' },
  heroRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  heroStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.md, padding: space.md, gap: 4 },
  heroStatTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  between: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
