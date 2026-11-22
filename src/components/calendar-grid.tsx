import { Pressable, StyleSheet, View } from 'react-native';

import { WEEKDAYS_SHORT, daysInMonth, monthKey, todayKey, type MonthRef } from '@/lib/dates';
import { useTheme } from '@/theme';
import { AppText } from './text';
import { tap } from './ui';

/**
 * A month calendar. Used both as the spending heat-map (Insights) and as the
 * date picker (Add Transaction).
 *  - `intensity[i]` (0..1) tints day i+1 — leave it out for a plain calendar.
 */
export function CalendarGrid({
  month, selected, onSelect, intensity, renderSub,
}: {
  month: MonthRef;
  selected?: string;
  onSelect?: (dateKey: string) => void;
  intensity?: number[];
  renderSub?: (day: number) => string | null;
}) {
  const { colors } = useTheme();
  const first = new Date(month.year, month.month, 1).getDay();
  const count = daysInMonth(month);
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const prefix = monthKey(month);
  const today = todayKey();

  return (
    <View>
      <View style={styles.row}>
        {WEEKDAYS_SHORT.map((d) => (
          <AppText key={d} variant="caption" tone="faint" style={styles.weekday}>{d.slice(0, 2)}</AppText>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.row}>
          {cells.slice(r * 7, r * 7 + 7).map((day, c) => {
            if (!day) return <View key={c} style={styles.cell} />;
            const key = `${prefix}-${String(day).padStart(2, '0')}`;
            const isSel = key === selected;
            const isToday = key === today;
            const heat = intensity?.[day - 1] ?? 0;
            const sub = renderSub?.(day);
            return (
              <Pressable
                key={c}
                onPress={() => { tap(); onSelect?.(key); }}
                style={styles.cell}>
                <View
                  style={[
                    styles.day,
                    heat > 0 && { backgroundColor: colors.expense + Math.round(20 + heat * 160).toString(16).padStart(2, '0') },
                    isToday && { borderColor: colors.primary, borderWidth: 1.5 },
                    isSel && { backgroundColor: colors.primary },
                  ]}>
                  <AppText
                    variant="bodyStrong"
                    style={{ fontSize: 14, color: isSel ? colors.onPrimary : heat > 0.6 ? '#fff' : colors.text }}>
                    {day}
                  </AppText>
                  {sub ? (
                    <AppText style={{ fontSize: 8, fontWeight: '600', color: isSel || heat > 0.6 ? '#fff' : colors.textMuted }} numberOfLines={1}>
                      {sub}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', marginBottom: 6, fontSize: 12 },
  cell: { flex: 1, aspectRatio: 1, padding: 2 },
  day: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
