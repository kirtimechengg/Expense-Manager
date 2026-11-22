/**
 * ACTIVITY — every transaction, grouped by day, with search and filters.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, TextInput, View } from 'react-native';

import { MonthSwitcher } from '@/components/month-switcher';
import { BOTTOM_SPACE, Screen } from '@/components/screen';
import { AppText } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { Amount, Chip, EmptyState, Segmented } from '@/components/ui';
import { friendlyDate } from '@/lib/dates';
import { inMonth, inYear, totalsOf } from '@/lib/stats';
import type { Transaction, TxnType } from '@/lib/types';
import { useData } from '@/state/data';
import { usePeriod } from '@/state/period';
import { radius, space, useTheme } from '@/theme';

type Scope = 'month' | 'year' | 'all';
type TypeFilter = 'all' | TxnType;

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const { transactions, categoryById } = useData();
  const { period } = usePeriod();
  const [scope, setScope] = useState<Scope>('month');
  const [type, setType] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let list = scope === 'month' ? inMonth(transactions, period) : scope === 'year' ? inYear(transactions, period.year) : transactions;
    if (type !== 'all') list = list.filter((t) => t.type === type);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const cat = categoryById.get(t.categoryId)?.name ?? '';
        return t.note.toLowerCase().includes(q) || cat.toLowerCase().includes(q) || String(t.amount).includes(q);
      });
    }
    return list;
  }, [transactions, categoryById, period, scope, type, query]);

  const sections = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return [...map.entries()].map(([date, data]) => ({ date, data, total: totalsOf(data) }));
  }, [filtered]);

  const totals = totalsOf(filtered);

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.sm }}>
      <Segmented<Scope>
        value={scope}
        onChange={setScope}
        options={[{ value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }, { value: 'all', label: 'All time' }]}
      />
      {scope !== 'all' ? <MonthSwitcher mode={scope === 'year' ? 'year' : 'month'} /> : null}
      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes, categories, amounts"
          placeholderTextColor={colors.textFaint}
          style={[styles.searchInput, { color: colors.text }]}
          clearButtonMode="while-editing"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        <Chip label="All" selected={type === 'all'} onPress={() => setType('all')} />
        <Chip label="Expenses" icon="arrow-up" color={colors.expense} selected={type === 'expense'} onPress={() => setType('expense')} />
        <Chip label="Income" icon="arrow-down" color={colors.income} selected={type === 'income'} onPress={() => setType('income')} />
        <Chip label="Investments" icon="trending-up" color={colors.invest} selected={type === 'investment'} onPress={() => setType('investment')} />
      </ScrollView>
      <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Summary label="In" value={totals.income} tone="income" />
        <Summary label="Invested" value={totals.invested} tone="invest" />
        <Summary label="Out" value={totals.spent} tone="expense" />
      </View>
    </View>
  );

  return (
    <Screen title="Activity" subtitle={`${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`} scroll={false}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: BOTTOM_SPACE }}
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <AppText variant="label" tone="muted">{friendlyDate(section.date)}</AppText>
            {section.total.spent > 0 ? <Amount value={-section.total.spent} variant="caption" tone="muted" /> : null}
          </View>
        )}
        renderItem={({ item }) => <TransactionRow txn={item} />}
        ListEmptyComponent={
          <EmptyState
            icon="search"
            title={query ? 'No matches' : 'No transactions'}
            message={query ? 'Try a different search.' : 'Tap + to add one.'}
          />
        }
      />
    </Screen>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: 'income' | 'invest' | 'expense' }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <AppText variant="caption" tone="muted">{label}</AppText>
      <Amount value={value} compact variant="bodyStrong" tone={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md, height: 44,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, height: '100%' },
  summary: { flexDirection: 'row', borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingVertical: space.md },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.lg, marginBottom: 2 },
});
