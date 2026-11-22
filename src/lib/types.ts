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
  /** Cloud name of the receipt photo ("" = none). */
  receiptPath: string;
  /** Where the photo is on this device (null = not downloaded yet). */
  receiptLocal: string | null;
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
  /** Ask for Face ID / fingerprint / passcode when opening the app. */
  lockEnabled: boolean;
  /** How long the app may stay in the background before it locks again (0 = immediately). */
  lockAfterSeconds: number;
}
