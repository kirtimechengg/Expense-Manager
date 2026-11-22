/**
 * Indian-style money formatting: ₹1,23,45,678.50
 * Written by hand (instead of Intl) so it looks identical on every phone.
 */

const RUPEE = '₹';

function groupIndian(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

/** ₹1,23,456  (paise shown only when not a whole number, or when `decimals` is forced) */
export function formatMoney(value: number, opts: { decimals?: boolean; sign?: boolean } = {}): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n);
  const showDecimals = opts.decimals ?? !Number.isInteger(Math.round(abs * 100) / 100);
  const fixed = abs.toFixed(showDecimals ? 2 : 0);
  const [i, d] = fixed.split('.');
  const body = RUPEE + groupIndian(i) + (d ? '.' + d : '');
  if (n < 0) return '−' + body;
  if (opts.sign && n > 0) return '+' + body;
  return body;
}

/** Short form for charts and tight spaces: ₹950, ₹12.5K, ₹3.2L, ₹1.1Cr */
export function formatCompact(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  const trim = (x: number) => (x >= 100 ? x.toFixed(0) : x.toFixed(1).replace(/\.0$/, ''));
  if (abs >= 1e7) return `${sign}${RUPEE}${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}${RUPEE}${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}${RUPEE}${trim(abs / 1e3)}K`;
  return `${sign}${RUPEE}${Math.round(abs)}`;
}

/** Turns what the user typed ("1,250.5") into a number, or null if invalid. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, '');
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === '' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export const MASK = '••••';
