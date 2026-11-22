/**
 * NET WORTH — all-time picture: how much came in, how much is invested, how much was spent.
 *   Net worth = Cash (income − invested − spent) + Invested
 */
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { StackedBar } from '@/components/charts';
import { Screen } from '@/components/screen';
import { AppText } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { Amount, Card, CategoryIcon, EmptyState, ProgressBar, SectionHeader } from '@/components/ui';
import { byCategory, totalsOf } from '@/lib/stats';
import { useData } from '@/state/data';
import { radius, space, useTheme } from '@/theme';

export default function NetWorthScreen() {
  const { colors } = useTheme();
  const { transactions, categoryById } = useData();
  const t = totalsOf(transactions);
  const netWorth = t.cash + t.invested;
  const portfolio = byCategory(transactions, 'investment');
  const investTxns = transactions.filter((x) => x.type === 'investment').slice(0, 20);

  return (
    <Screen title="Net Worth" subtitle="All time">
      <LinearGradient colors={['#0F766E', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <AppText variant="label" style={{ color: 'rgba(255,255,255,0.75)' }}>Total net worth</AppText>
        <Amount value={netWorth} variant="display" style={{ color: '#fff' }} />
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <StackedBar
            parts={[
              { value: Math.max(0, t.invested), color: '#93C5FD' },
              { value: Math.max(0, t.cash), color: '#6EE7B7' },
            ]}
          />
          <View style={styles.legendRow}>
            <AppText variant="caption" style={styles.heroCaption}>■ Invested</AppText>
            <AppText variant="caption" style={[styles.heroCaption, { color: '#6EE7B7' }]}>■ Cash</AppText>
          </View>
        </View>
      </LinearGradient>

      <Card padded={false}>
        <Line icon="arrow-down-circle" color={colors.income} title="Total income" sub="Salary, bonus, interest…" value={t.income} tone="income" />
        <Line icon="briefcase" color={colors.invest} title="Assets & investments" sub="MF, PF, PPF, NPS, equity…" value={t.invested} tone="invest" />
        <Line icon="arrow-up-circle" color={colors.expense} title="Living expenses" sub="Food, travel, bills…" value={t.spent} tone="expense" />
        <Line icon="wallet" color={colors.primary} title="Cash in hand" sub="Income − invested − spent" value={t.cash} last />
      </Card>

      <Card>
        <SectionHeader title="Portfolio" />
        {portfolio.length === 0 ? (
          <EmptyState icon="trending-up" title="No investments yet" message="Add a transaction with type “Investment” to build your portfolio." />
        ) : (
          <View style={{ gap: space.md }}>
            {portfolio.map((p) => {
              const cat = categoryById.get(p.categoryId);
              return (
                <View key={p.categoryId} style={styles.row}>
                  <CategoryIcon icon={cat?.icon ?? 'help'} color={cat?.color ?? '#94A3B8'} size={36} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={styles.between}>
                      <AppText variant="bodyStrong">{cat?.name ?? 'Uncategorised'}</AppText>
                      <Amount value={p.total} variant="bodyStrong" />
                    </View>
                    <View style={styles.between}>
                      <View style={{ flex: 1 }}>
                        <ProgressBar value={p.share} color={cat?.color} height={6} />
                      </View>
                      <AppText variant="caption" tone="muted" style={{ width: 44, textAlign: 'right' }}>
                        {Math.round(p.share * 100)}%
                      </AppText>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {investTxns.length ? (
        <Card>
          <SectionHeader title="Recent investments" />
          {investTxns.map((x) => <TransactionRow key={x.id} txn={x} showDate />)}
        </Card>
      ) : null}
    </Screen>
  );
}

function Line({ icon, color, title, sub, value, tone, last }: {
  icon: string; color: string; title: string; sub: string; value: number; tone?: 'income' | 'invest' | 'expense'; last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.line, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <CategoryIcon icon={icon} color={color} size={42} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" tone="muted">{sub}</AppText>
      </View>
      <Amount value={value} variant="heading" tone={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.xs },
  heroCaption: { color: '#93C5FD' },
  legendRow: { flexDirection: 'row', gap: space.lg },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});
