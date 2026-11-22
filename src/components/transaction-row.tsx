import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { friendlyDate } from '@/lib/dates';
import type { Transaction } from '@/lib/types';
import { useData } from '@/state/data';
import { space } from '@/theme';
import { AppText } from './text';
import { Amount, CategoryIcon, tap } from './ui';

/** One transaction in a list. Tap to edit. */
export function TransactionRow({ txn, showDate = false }: { txn: Transaction; showDate?: boolean }) {
  const { categoryById } = useData();
  const cat = categoryById.get(txn.categoryId);
  const title = txn.note || cat?.name || 'Uncategorised';
  const sub = [txn.note ? cat?.name : null, showDate ? friendlyDate(txn.date) : null].filter(Boolean).join(' · ');
  const sign = txn.type === 'income' ? '+' : txn.type === 'expense' ? '−' : '';

  return (
    <Pressable
      onPress={() => { tap(); router.push({ pathname: '/transaction', params: { id: txn.id } }); }}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <CategoryIcon icon={cat?.icon ?? 'help'} color={cat?.color ?? '#94A3B8'} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>{title}</AppText>
        {sub ? <AppText variant="caption" tone="muted" numberOfLines={1}>{sub}</AppText> : null}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <AppText variant="bodyStrong" tone={txn.type === 'income' ? 'income' : txn.type === 'investment' ? 'invest' : 'default'}>
          {sign}
        </AppText>
        <Amount value={txn.amount} variant="bodyStrong" type={txn.type === 'expense' ? undefined : txn.type} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
});
