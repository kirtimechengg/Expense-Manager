/**
 * Small building blocks used by every screen: cards, buttons, chips, progress bars…
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { MASK, formatCompact, formatMoney } from '@/lib/money';
import type { TxnType } from '@/lib/types';
import { useData } from '@/state/data';
import { radius, space, useTheme } from '@/theme';
import { AppText, type AppTextProps } from './text';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function tap() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { colors, dark } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        !dark && styles.cardShadow,
        padded && { padding: space.lg },
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading">{title}</AppText>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <AppText variant="caption" tone="primary">{action}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A money value that respects Privacy Mode. */
export function Amount({
  value, type, compact, sign, ...text
}: { value: number; type?: TxnType | 'auto'; compact?: boolean; sign?: boolean } & AppTextProps) {
  const { prefs } = useData();
  let tone: AppTextProps['tone'] = text.tone;
  if (type === 'income') tone = 'income';
  else if (type === 'investment') tone = 'invest';
  else if (type === 'expense') tone = 'expense';
  else if (type === 'auto') tone = value < 0 ? 'expense' : 'income';
  const label = prefs.privacyMode ? MASK : compact ? formatCompact(value) : formatMoney(value, { sign });
  return (
    <AppText tabular {...text} tone={tone}>
      {label}
    </AppText>
  );
}

export function CategoryIcon({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size * 0.34,
        backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center',
      }}>
      <Ionicons name={icon as IconName} size={size * 0.5} color={color} />
    </View>
  );
}

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value || 0));
  const over = value > 1;
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.cardMuted, overflow: 'hidden' }}>
      <View
        style={{
          width: `${pct * 100}%`, height: '100%', borderRadius: height,
          backgroundColor: over ? colors.expense : (color ?? colors.primary),
        }}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress, icon, color }: {
  label: string; selected?: boolean; onPress?: () => void; icon?: string; color?: string;
}) {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;
  return (
    <Pressable
      onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? accent + '1F' : colors.card,
          borderColor: selected ? accent : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {icon ? <Ionicons name={icon as IconName} size={16} color={selected ? accent : colors.textMuted} /> : null}
      <AppText variant="caption" style={{ color: selected ? accent : colors.text }}>{label}</AppText>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const { colors, dark } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.cardMuted }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { tap(); onChange(o.value); }}
            style={[
              styles.segment,
              active && { backgroundColor: dark ? colors.border : colors.card },
              active && !dark && styles.cardShadow,
            ]}>
            <AppText variant="caption" style={{ color: active ? colors.text : colors.textMuted, fontWeight: '700' }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary', icon, disabled, style }: {
  label: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg = { primary: colors.primary, secondary: colors.primarySoft, danger: colors.expenseSoft, ghost: 'transparent' }[variant];
  const fg = { primary: colors.onPrimary, secondary: colors.primary, danger: colors.expense, ghost: colors.primary }[variant];
  return (
    <Pressable
      disabled={disabled}
      onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}>
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <AppText variant="bodyStrong" style={{ color: fg }}>{label}</AppText>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, tint }: { icon: IconName; onPress?: () => void; label: string; tint?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name={icon} size={20} color={tint ?? colors.text} />
    </Pressable>
  );
}

export function EmptyState({ icon, title, message, children }: { icon: IconName; title: string; message?: string; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>{title}</AppText>
      {message ? <AppText tone="muted" style={{ textAlign: 'center' }}>{message}</AppText> : null}
      {children}
    </View>
  );
}

/** Row used in settings-style lists. */
export function ListRow({ icon, iconColor, title, subtitle, right, onPress, last }: {
  icon?: IconName; iconColor?: string; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.6 : 1 }]}>
      {icon ? <CategoryIcon icon={icon} color={iconColor ?? colors.primary} size={34} /> : null}
      <View style={[styles.listRowBody, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{title}</AppText>
          {subtitle ? <AppText variant="caption" tone="muted">{subtitle}</AppText> : null}
        </View>
        {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null)}
      </View>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  cardShadow: {
    shadowColor: '#1E1B4B', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1,
  },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md - 3 },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 18, borderRadius: radius.md,
  },
  iconButton: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth,
  },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg },
  listRowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 12, paddingRight: space.lg },
});
