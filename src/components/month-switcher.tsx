import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { MONTHS_LONG } from '@/lib/dates';
import { usePeriod } from '@/state/period';
import { radius, useTheme } from '@/theme';
import { AppText } from './text';
import { tap } from './ui';

/** ‹  November 2026  ›   — in "year" mode it moves 12 months at a time. */
export function MonthSwitcher({ mode = 'month' }: { mode?: 'month' | 'year' }) {
  const { colors } = useTheme();
  const { period, shift, goToToday, isCurrent } = usePeriod();
  const step = mode === 'year' ? 12 : 1;
  const label = mode === 'year' ? String(period.year) : `${MONTHS_LONG[period.month]} ${period.year}`;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable accessibilityLabel="Previous" hitSlop={8} onPress={() => { tap(); shift(-step); }} style={styles.arrow}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <Pressable onPress={() => { tap(); goToToday(); }} style={styles.center} accessibilityLabel="Go to current month">
        <AppText variant="bodyStrong">{label}</AppText>
        {!isCurrent ? (
          <View style={[styles.today, { backgroundColor: colors.primarySoft }]}>
            <AppText variant="caption" tone="primary" style={{ fontSize: 11 }}>Today</AppText>
          </View>
        ) : null}
      </Pressable>
      <Pressable accessibilityLabel="Next" hitSlop={8} onPress={() => { tap(); shift(step); }} style={styles.arrow}>
        <Ionicons name="chevron-forward" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, height: 46,
  },
  arrow: { width: 48, height: '100%', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  today: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
});
