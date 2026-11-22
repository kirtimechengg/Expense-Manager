/**
 * Lightweight charts drawn with plain Views (no chart library needed).
 */
import { StyleSheet, View } from 'react-native';

import { formatCompact } from '@/lib/money';
import { useData } from '@/state/data';
import { useTheme } from '@/theme';
import { AppText } from './text';

export interface BarGroup {
  label: string;
  values: { value: number; color: string }[];
  highlight?: boolean;
}

/** Side-by-side bars per group (e.g. Income vs Spent for each month). */
export function BarChart({ data, height = 140 }: { data: BarGroup[]; height?: number }) {
  const { colors } = useTheme();
  const { prefs } = useData();
  const rawMax = Math.max(0, ...data.flatMap((g) => g.values.map((v) => v.value)));
  const max = rawMax || 1;

  return (
    <View>
      {!prefs.privacyMode && rawMax > 0 ? (
        <AppText variant="caption" tone="faint" style={{ marginBottom: 6 }}>{formatCompact(max)}</AppText>
      ) : null}
      <View style={[styles.plot, { height, borderBottomColor: colors.border }]}>
        <View style={[styles.gridLine, { top: 0, borderColor: colors.border }]} />
        <View style={[styles.gridLine, { top: height / 2, borderColor: colors.border }]} />
        {data.map((g, i) => (
          <View key={i} style={styles.group}>
            {g.values.map((v, j) => (
              <View
                key={j}
                style={{
                  width: g.values.length > 1 ? 7 : 14,
                  height: Math.max(v.value > 0 ? 3 : 0, (v.value / max) * height),
                  backgroundColor: v.color,
                  opacity: g.highlight === false ? 0.45 : 1,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {data.map((g, i) => (
          <AppText
            key={i}
            variant="caption"
            tone={g.highlight ? 'default' : 'faint'}
            style={[styles.label, g.highlight && { fontWeight: '700' }]}>
            {g.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: i.color }]} />
          <AppText variant="caption" tone="muted">{i.label}</AppText>
        </View>
      ))}
    </View>
  );
}

/** One horizontal bar made of coloured segments (used for "where the money went"). */
export function StackedBar({ parts, height = 12 }: { parts: { value: number; color: string }[]; height?: number }) {
  const { colors } = useTheme();
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: height, overflow: 'hidden', backgroundColor: colors.cardMuted, gap: 2 }}>
      {total > 0 ? parts.map((p, i) => <View key={i} style={{ flex: p.value / total, backgroundColor: p.color }} />) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth },
  gridLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' },
  group: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  labels: { flexDirection: 'row', marginTop: 6 },
  label: { flex: 1, textAlign: 'center', fontSize: 11 },
  legend: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
