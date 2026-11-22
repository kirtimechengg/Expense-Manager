import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label';
type Tone = 'default' | 'muted' | 'faint' | 'primary' | 'income' | 'invest' | 'expense' | 'onPrimary';

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '500' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  /** Use digits that line up in columns (good for money). */
  tabular?: boolean;
}

/** The only Text component screens should use — it applies theme colours automatically. */
export function AppText({ variant = 'body', tone = 'default', tabular, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const color = {
    default: colors.text,
    muted: colors.textMuted,
    faint: colors.textFaint,
    primary: colors.primary,
    income: colors.income,
    invest: colors.invest,
    expense: colors.expense,
    onPrimary: colors.onPrimary,
  }[tone];
  return (
    <Text
      style={[VARIANTS[variant], { color }, tabular && { fontVariant: ['tabular-nums'] }, style]}
      {...rest}
    />
  );
}
