import type { TxnType } from './types';

/**
 * Categories created the first time the app opens.
 * Same list as the old Gemini app, now with an explicit kind, icon and colour.
 * Icon names come from Ionicons: https://icons.expo.fyi (filter by "Ionicons").
 */
export const DEFAULT_CATEGORIES: { name: string; kind: TxnType; icon: string; color: string }[] = [
  // Expenses
  { name: 'Food & Dining', kind: 'expense', icon: 'restaurant', color: '#F97316' },
  { name: 'Transportation', kind: 'expense', icon: 'car', color: '#0EA5E9' },
  { name: 'Utilities', kind: 'expense', icon: 'flash', color: '#EAB308' },
  { name: 'Entertainment', kind: 'expense', icon: 'film', color: '#EC4899' },
  { name: 'Shopping', kind: 'expense', icon: 'bag-handle', color: '#A855F7' },
  { name: 'Health', kind: 'expense', icon: 'medkit', color: '#EF4444' },
  { name: 'School', kind: 'expense', icon: 'school', color: '#6366F1' },
  { name: 'Loan', kind: 'expense', icon: 'card', color: '#78716C' },
  { name: 'Travel', kind: 'expense', icon: 'airplane', color: '#14B8A6' },
  // Investments
  { name: 'MF', kind: 'investment', icon: 'trending-up', color: '#3B82F6' },
  { name: 'Equity', kind: 'investment', icon: 'stats-chart', color: '#6366F1' },
  { name: 'PF', kind: 'investment', icon: 'shield-checkmark', color: '#14B8A6' },
  { name: 'PPF', kind: 'investment', icon: 'lock-closed', color: '#10B981' },
  { name: 'NPS', kind: 'investment', icon: 'umbrella', color: '#0EA5E9' },
  { name: 'Other Investment', kind: 'investment', icon: 'diamond', color: '#A855F7' },
  // Income
  { name: 'Salary', kind: 'income', icon: 'briefcase', color: '#10B981' },
  { name: 'Bonus', kind: 'income', icon: 'gift', color: '#84CC16' },
  { name: 'Interest', kind: 'income', icon: 'cash', color: '#14B8A6' },
  { name: 'Business', kind: 'income', icon: 'storefront', color: '#F97316' },
  { name: 'Dividend', kind: 'income', icon: 'pie-chart', color: '#3B82F6' },
  { name: 'Reverse payment', kind: 'income', icon: 'return-down-back', color: '#A855F7' },
  { name: 'Other Income', kind: 'income', icon: 'wallet', color: '#78716C' },
];

/** Icons offered when creating/editing a category. */
export const CATEGORY_ICONS = [
  'restaurant', 'cafe', 'fast-food', 'cart', 'bag-handle', 'shirt', 'car', 'bus', 'train', 'airplane',
  'bicycle', 'flash', 'water', 'wifi', 'call', 'home', 'bed', 'build', 'medkit', 'fitness',
  'school', 'book', 'film', 'game-controller', 'musical-notes', 'paw', 'gift', 'heart', 'people', 'card',
  'cash', 'wallet', 'briefcase', 'storefront', 'trending-up', 'stats-chart', 'pie-chart', 'shield-checkmark',
  'lock-closed', 'umbrella', 'diamond', 'business', 'globe', 'leaf', 'return-down-back', 'ellipsis-horizontal',
] as const;

export const TYPE_LABEL: Record<TxnType, string> = {
  expense: 'Expense',
  income: 'Income',
  investment: 'Investment',
};
