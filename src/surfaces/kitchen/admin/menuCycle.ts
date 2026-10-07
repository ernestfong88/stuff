/** Menu cycle arithmetic for the venue pages. */
import type { MenuSummary } from '../../../store/venueSettings';

const DAY = 86_400_000;

const midnight = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Day of the cycle a menu is on (1 = its start date), wrapping round the
 * cycle; null for a static menu or no start date. Matches the legacy
 * formula, days before the start count backwards round the cycle.
 */
export function cycleDay(startDt: number | null, cycleLen: number, at: number): number | null {
  if (!startDt || !cycleLen || cycleLen < 1) return null;
  const day = Math.round((midnight(at) - midnight(startDt)) / DAY) + 1;
  const r = ((day % cycleLen) + cycleLen) % cycleLen;
  return r === 0 ? cycleLen : r;
}

/** "Week 3 of 5", or null when there is no cycle to count. */
export function cycleWeekLabel(startDt: number | null, menu: MenuSummary | undefined, at: number): string | null {
  if (!menu) return null;
  const d = cycleDay(startDt, menu.cycleLen, at);
  return d == null ? null : `Week ${Math.ceil(d / 7)} of ${Math.ceil(menu.cycleLen / 7)}`;
}

export const isStaticMenu = (m: MenuSummary) => (m.kind || (m.cycleLen > 0 ? 'cycle' : 'alc')) === 'alc';

export interface QuarterStyle {
  label: string;
  season: string;
  /** Ink and tint. */
  fg: string;
  bg: string;
}

const SEASONS: Record<number, Omit<QuarterStyle, 'label'>> = {
  1: { season: 'Winter', fg: '#2E5E8C', bg: '#E3EDF7' },
  2: { season: 'Spring', fg: '#2F7A3A', bg: '#E3F1E4' },
  3: { season: 'Summer', fg: '#8A5A00', bg: '#FBEFD6' },
  4: { season: 'Fall', fg: '#A04A16', bg: '#FBE6D8' },
};

/** "Q4 2026", "Year-round", or "" when the menu says nothing about when it runs. */
export function menuQuarter(m: MenuSummary): string {
  if (m.quarter) return m.quarter;
  const text = m.season || m.name || '';
  const year = /(20\d\d)/.exec(text)?.[1];
  if (/year.?round|all.?day/i.test(text) && !year) return 'Year-round';
  if (!year) return '';
  const q = /fall/i.test(text) ? 4 : /summer/i.test(text) ? 3 : /spring/i.test(text) ? 2 : /winter/i.test(text) ? 1 : 0;
  return q ? `Q${q} ${year}` : '';
}

/** Colours for a quarter badge: by season, neutral for "Year-round". */
export function quarterStyle(q: string): QuarterStyle {
  const m = /^Q([1-4]) (\d{4})$/.exec(q);
  if (!m) return { label: q, season: '', fg: '#5C6873', bg: '#EEF1F4' };
  return { label: q, ...SEASONS[+m[1]] };
}
