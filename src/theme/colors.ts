/**
 * Design tokens — every colour in the app comes from here.
 * Change a value once and the whole app updates (light + dark).
 */

export const palette = {
  light: {
    background: '#F4F5FA',
    card: '#FFFFFF',
    cardMuted: '#F0F1F7',
    border: '#E4E6EF',
    text: '#0F172A',
    textMuted: '#64748B',
    textFaint: '#94A3B8',
    primary: '#5B4FE9',
    primarySoft: '#ECEAFF',
    onPrimary: '#FFFFFF',
    income: '#0EA371',
    incomeSoft: '#DDF6EC',
    invest: '#2F6FEB',
    investSoft: '#E0EAFE',
    expense: '#E5484D',
    expenseSoft: '#FDE5E6',
    warning: '#F59E0B',
    heroFrom: '#5B4FE9',
    heroTo: '#8B5CF6',
  },
  dark: {
    background: '#0B1020',
    card: '#151B2E',
    cardMuted: '#1C2339',
    border: '#252D46',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    textFaint: '#64748B',
    primary: '#8B83FF',
    primarySoft: '#25224A',
    onPrimary: '#FFFFFF',
    income: '#34D399',
    incomeSoft: '#10302A',
    invest: '#60A5FA',
    investSoft: '#14284A',
    expense: '#F87171',
    expenseSoft: '#3A1A20',
    warning: '#FBBF24',
    heroFrom: '#4338CA',
    heroTo: '#7C3AED',
  },
} as const;

export type ThemeColors = { [K in keyof typeof palette.light]: string };

/** Colours you can pick for a category. */
export const CATEGORY_COLORS = [
  '#F97316', '#EF4444', '#EC4899', '#A855F7', '#6366F1', '#3B82F6',
  '#0EA5E9', '#14B8A6', '#10B981', '#84CC16', '#EAB308', '#78716C',
] as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
