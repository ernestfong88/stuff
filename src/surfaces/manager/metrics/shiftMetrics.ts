/**
 * Shift metrics: what a shift is scored on against the last seven, and how
 * a "great shift" is decided. Back Office, Shift Metrics sets the margin,
 * how many metrics must be ahead, which ones count and the comparison
 * averages.
 */
import { mean } from './stepsOfService';

export type MetricFormat = 'n' | 'm' | '%';

export interface MetricDef {
  k: string;
  label: string;
  fmt: MetricFormat;
  /** Which way is better; null keeps it for context only. */
  better: 'up' | 'down' | null;
  /** Shown as a count a shift, not scored as ahead or behind. */
  count?: boolean;
  note: string;
}

export const METRICS: MetricDef[] = [
  { k: 'covers', label: 'Covers', fmt: 'n', better: 'up', count: true, note: 'a dinner' },
  { k: 'closed', label: 'Tables turned', fmt: 'n', better: 'up', count: true, note: 'a dinner' },
  { k: 'greet', label: 'Greet to drinks', fmt: 'm', better: 'down', note: 'check opened to drinks served' },
  { k: 'seatGreet', label: 'Seated to greeted', fmt: 'm', better: 'down', note: 'when a host seated the table' },
  { k: 'slowGreet', label: 'Slow greetings', fmt: 'n', better: 'down', count: true, note: 'a dinner' },
  { k: 'toOrder', label: 'Seated to order in', fmt: 'm', better: 'down', note: 'seated to first send' },
  { k: 'ticket', label: 'Kitchen ticket', fmt: 'm', better: 'down', note: 'fired to up at the pass' },
  { k: 'pass', label: 'Plates waiting', fmt: 'm', better: 'down', note: 'at the pass before running' },
  { k: 'checkin', label: 'Checked in after entree', fmt: '%', better: 'up', note: 'of tables past C2' },
  { k: 'dessert', label: 'Dessert', fmt: '%', better: 'up', note: 'of closed checks' },
  { k: 'table', label: 'Table time', fmt: 'm', better: null, note: 'seated to closed' },
  { k: 'remakes', label: 'Remakes and comps', fmt: 'n', better: 'down', count: true, note: 'a dinner' },
  { k: 'cancels', label: 'Cancels', fmt: 'n', better: 'down', count: true, note: 'a dinner' },
];

/** The last seven dinners. The demo has no real week behind it, so these are fixed. */
export const WEEK: Record<string, number[]> = {
  covers: [44, 39, 51, 47, 42, 55, 49],
  closed: [16, 14, 18, 17, 15, 19, 17],
  toOrder: [6.8, 7.4, 6.1, 6.6, 7.9, 6.3, 7],
  ticket: [12.4, 13.6, 11.8, 12.9, 14.2, 12.1, 12.8],
  pass: [3.4, 4.1, 2.9, 3.6, 4.4, 3.1, 3.8],
  table: [61, 64, 58, 63, 66, 59, 62],
  checkin: [0.55, 0.48, 0.62, 0.58, 0.5, 0.64, 0.57],
  dessert: [0.36, 0.31, 0.41, 0.38, 0.33, 0.44, 0.39],
  remakes: [2, 3, 1, 2, 4, 2, 2],
  cancels: [1, 2, 0, 1, 2, 1, 1],
  greet: [4.1, 4.6, 3.8, 4.3, 5.2, 3.9, 4.4],
  seatGreet: [1.6, 2.1, 1.4, 1.8, 2.4, 1.5, 1.9],
  slowGreet: [2, 3, 1, 2, 4, 1, 2],
};

/** __kMetDefs: table time is only scored (shorter is better) when Back Office says so. */
export function metricDefs(tableShorter: boolean): MetricDef[] {
  return METRICS.map((m) => (m.k === 'table' ? { ...m, better: tableShorter ? 'down' : null } : m));
}

/** Scored metrics can count toward a great shift; counts and context ones cannot. */
export function isScored(m: MetricDef): boolean {
  return !!m.better && !m.count;
}

/** __kFmt: "6.8 min", "62 min", "57%", "44", or "Not yet". */
export function formatMetric(m: Pick<MetricDef, 'fmt'>, v: number | null): string {
  if (v == null) return 'Not yet';
  if (m.fmt === 'm') return `${v < 10 ? v.toFixed(1) : String(Math.round(v))} min`;
  if (m.fmt === '%') return `${Math.round(v * 100)}%`;
  return String(Math.round(v * 10) / 10);
}

export function weekAverage(k: string): number | null {
  return mean(WEEK[k] ?? []);
}
