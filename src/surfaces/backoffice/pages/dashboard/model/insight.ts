/** A "Start here" statement: the headline, why, and the next step. */
export type Tone = 'good' | 'warn' | 'bad';

export interface Insight {
  tone: Tone;
  head: string;
  body?: string;
  next?: string;
}

/** Goals the dashboard measures against. */
export const GOALS = {
  /** Order taken to appetizer served, minutes. */
  app: 7,
  /** Appetizer served to entrée served, minutes. */
  ent: 15,
  /** Comps as a share of revenue, percent. */
  comp: 5,
} as const;

/** Table time goal: order to entrée, both steps together. */
export const TABLE_TIME_GOAL = GOALS.app + GOALS.ent;

export const money0 = (v: number) => '$' + Math.round(v).toLocaleString('en-US');
export const min1 = (v: number | null) => (v == null ? '–' : v.toFixed(1));
