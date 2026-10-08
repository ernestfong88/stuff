/**
 * Triage as one list of what to do next: each row is a verb for one table
 * ("Run starters to EG 7"), how long it has waited, and the one tap the app
 * already offers for it. Rows past the Back Office mark go in Now, the rest
 * in Soon; kitchen trouble (a table fired too long ago, a pick up or
 * delivery due and not ready) gets its own small group.
 */
import type { CardAction } from '../../server/board/cardActions';
import { QUEUE_TYPE_LABELS } from '../../../domain/orders';
import { clockLabel, clockMinutes, parseClockTime, pickupDue, pickupStage, pickupWho, PICKUP_RANGE_MINUTES } from '../../../domain/pickup';
import type { Order } from '../../../domain/types';
import { MINUTE, now } from '../../../lib/clock';
import { plural } from '../../../lib/format';
import { courseWord } from '../floor/stage';
import type { ServerTriage, TriageKind, TriageReason, TriageRow } from '../floor/triage';

export interface TriageItem {
  key: string;
  order: Order;
  kind: TriageKind | 'pickup';
  late: boolean;
  mins: number;
  /** What to do, as a verb with the table in it. */
  label: string;
  /** The server's initials, or none for a pick up or delivery. */
  server?: string;
  /** For a pick up or delivery: "Due 5:30 PM". */
  due?: string;
  /** The table's other reasons, as plain text. */
  also: string[];
  course?: number;
  score: number;
}

export interface TriageGroups {
  /** Past the mark, worst first. */
  now: TriageItem[];
  /** Worth a look, longest wait first. */
  soon: TriageItem[];
  /** The kitchen's side: fired too long ago, pick ups and deliveries not ready. */
  kitchen: TriageItem[];
  /** Tables with nothing to do. */
  fine: TriageRow[];
}

/** __kTriageVerb: the row's words, e.g. "Run starters to EG 7". */
export function actionLabel(r: Pick<TriageReason, 'kind' | 'course'>, table: string): string {
  switch (r.kind) {
    case 'run':
      return `Run ${courseWord(r.course ?? 2).toLowerCase()} to ${table}`;
    case 'drinks':
      return `Get drinks to ${table}`;
    case 'greet':
      return `Greet ${table}`;
    case 'greetDrinks':
      return `Greet ${table} and take drinks`;
    case 'checkIn':
      return `Check in with ${table}`;
    case 'eat':
      return `Check on ${table}`;
    case 'cook':
      return `Ask the kitchen about ${table}`;
    case 'order':
      return `Take the order at ${table}`;
    case 'close':
      return `Close the check at ${table}`;
  }
}

const byScore = (a: TriageItem, b: TriageItem) => b.score - a.score;

/** One row per table that needs help: its worst reason, with the rest as "also". */
export function tableItem(row: TriageRow, table: string): TriageItem {
  const [w, ...more] = row.why;
  return {
    key: row.order.id,
    order: row.order,
    kind: w.kind,
    late: w.late,
    mins: w.mins,
    label: actionLabel(w, table),
    server: row.order.server,
    also: more.map((x) => x.text),
    course: w.course,
    score: w.score,
  };
}

/**
 * __kTriagePickup: pick ups and deliveries due and not ready. Amber from the
 * start of the booked range, red once the range has passed (when the order
 * counts as late on Pick Up & Delivery).
 */
export function pickupIssues(orders: Order[], kitchenMode?: string, at: number = now()): TriageItem[] {
  return orders
    .filter((o) => o.queueType && !o.closedAt && !o.deliveredAt && parseClockTime(o.readyAt))
    .flatMap((o): TriageItem[] => {
      const stage = pickupStage(o, kitchenMode);
      const due = pickupDue(o);
      if ((stage !== 'cooking' && stage !== 'scheduled') || at < due) return [];
      const late = at >= due + PICKUP_RANGE_MINUTES * MINUTE;
      const mins = clockMinutes(due, at);
      const what = QUEUE_TYPE_LABELS[o.assoc ? 'associate' : o.queueType!].toLowerCase();
      return [
        {
          key: o.id,
          order: o,
          kind: 'pickup',
          late,
          mins,
          label: `Chase the ${what} for ${pickupWho(o)}`,
          due: `Due ${clockLabel(due)}`,
          also: [stage === 'scheduled' ? 'Not fired yet' : 'Still cooking'],
          score: (late ? 1000 : 0) + mins,
        },
      ];
    })
    .sort(byScore);
}

/** __kTriageGroups: Now, Soon, Kitchen and the tables that are fine. */
export function triageGroups(rows: TriageRow[], name: (o: Order) => string, pickups: TriageItem[] = []): TriageGroups {
  const items = rows
    .filter((r) => r.why.length)
    .map((r) => tableItem(r, name(r.order)))
    .sort(byScore);
  const floor = items.filter((x) => x.kind !== 'cook');
  return {
    now: floor.filter((x) => x.late),
    soon: floor.filter((x) => !x.late),
    kitchen: [...items.filter((x) => x.kind === 'cook'), ...pickups].sort(byScore),
    fine: rows.filter((r) => !r.why.length),
  };
}

export type RowAction =
  | { kind: 'served'; course: number }
  | { kind: 'checkIn'; course: number }
  | { kind: 'drinks' }
  | { kind: 'quickClose' }
  | { kind: 'fire'; course: number; fireAs: number[]; label: string };

/**
 * __kTriageTap: the one-tap fix for a row, taken from what the table's card
 * on My Tables offers. Anything that needs the check (taking an order,
 * payment, what to grab) opens it instead, so there is no button.
 */
export function rowActions(kind: TriageItem['kind'], acts: CardAction[]): RowAction[] {
  const find = <K extends CardAction['kind']>(...ks: K[]) => acts.find((a): a is Extract<CardAction, { kind: K }> => ks.includes(a.kind as K));
  switch (kind) {
    case 'run': {
      const a = find('run', 'markServed');
      return a ? [{ kind: 'served', course: a.course }] : [];
    }
    case 'drinks':
      return find('drinks') ? [{ kind: 'drinks' }] : [];
    case 'checkIn':
    case 'eat': {
      const a = find('checkIn', 'fire');
      if (!a) return [];
      return a.kind === 'checkIn' ? [{ kind: 'checkIn', course: a.course }] : [{ kind: 'fire', course: a.course, fireAs: a.fireAs, label: a.label }];
    }
    case 'close':
      return find('quickClose') ? [{ kind: 'quickClose' }] : [];
    default:
      return [];
  }
}

/** The button's words. */
export function rowActionLabel(a: RowAction): string {
  switch (a.kind) {
    case 'served':
      return 'Mark served';
    case 'checkIn':
      return 'Checked in';
    case 'drinks':
      return 'Drinks out';
    case 'quickClose':
      return 'Quick close';
    case 'fire':
      return a.label;
  }
}

/** By associate: "4 need help", "1 needs help" or "All good". */
export function needText(x: Pick<ServerTriage, 'need'>): string {
  return x.need.length ? `${x.need.length} need${x.need.length === 1 ? 's' : ''} help` : 'All good';
}

/** By associate: "7 tables · 17 covers". */
export function loadText(x: Pick<ServerTriage, 'rows' | 'covers'>): string {
  return `${plural(x.rows.length, 'table')} · ${x.covers} covers`;
}
