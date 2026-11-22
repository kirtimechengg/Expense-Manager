/** The three kinds of money movement the app tracks. */
export type TxnType = 'expense' | 'income' | 'investment';

export interface Category {
  id: string;
  name: string;
  /** Which kind of transaction this category belongs to. */
  kind: TxnType;
  /** Ionicons icon name, e.g. "restaurant". */
  icon: string;
  /** Hex colour, e.g. "#F97316". */
  color: string;
  sortOrder: number;
}

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number;
  categoryId: string;
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  categoryId: string;
  /** "YYYY-MM" */
  month: string;
  amount: number;
  remark: string;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface Prefs {
  privacyMode: boolean;
  theme: ThemePref;
}
