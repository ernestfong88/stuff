/**
 * Check timeline timing: how long each moment of a meal took on one check,
 * read from its activity trail (order.log), and coloured by the amber and
 * red minutes set in HO Settings › Alerts & Timing ("Check timeline").
 *
 *   Waiting to order  check opened → first order sent         gap.send
 *   Cooking           a course sent or fired → its plates up   gap.ready
 *   Plates up         plates up → run to the table             gap.run
 *   Eating            course run → the server's check-in       gap.checkin
 *
 * Each moment shows its slowest stretch on the check. Printer kitchens log
 * no ready or run steps, so only Waiting to order shows there.
 */
import { MINUTE } from '../lib/clock';
import type { Order, OrderLogEvent } from './types';

export type GapKey = 'send' | 'ready' | 'run' | 'checkin';
export type GapTone = 'ok' | 'amber' | 'red';

/** Amber and red minutes per moment; 0 or missing means that colour is off. */
export type GapSettings = Partial<Record<GapKey, ReadonlyArray<number | string | null | undefined>>>;

export const GAP_LABELS: Record<GapKey, string> = {
  send: 'Waiting to order',
  ready: 'Cooking',
  run: 'Plates up',
  checkin: 'Eating',
};

export interface CheckGap {
  key: GapKey;
  label: string;
  /** The slowest stretch, in whole minutes (rounded to the half minute). */
  mins: number;
  tone: GapTone;
}

const isFire = (e: OrderLogEvent) => e.k === 'send' || e.k === 'fire';
const isReady = (e: OrderLogEvent) => e.k === 'ready' || (e.k === 'kstate' && e.what.endsWith(' up at the pass'));
const isRun = (e: OrderLogEvent) => e.k === 'run' || (e.k === 'kstate' && e.what.startsWith('Ran '));

/** The colour for a stretch: red past the red mark, amber past the amber one. */
export function gapTone(mins: number, marks: GapSettings[GapKey] = []): GapTone {
  const amber = Number(marks?.[0]) || 0;
  const red = Number(marks?.[1]) || 0;
  if (red > 0 && mins >= red) return 'red';
  if (amber > 0 && mins >= amber) return 'amber';
  return 'ok';
}

/** The slowest stretch of each moment on a check, in service order. Moments that never happened are left out. */
export function checkGaps(o: Pick<Order, 'openedAt' | 'log'>, settings: GapSettings = {}): CheckGap[] {
  const log = [...(o.log ?? [])].sort((a, b) => a.at - b.at);
  const worst: Partial<Record<GapKey, number>> = {};
  const note = (k: GapKey, from: number | null, to: number) => {
    if (from == null || to < from) return;
    worst[k] = Math.max(worst[k] ?? 0, to - from);
  };
  const opened = log.find((e) => e.k === 'open')?.at ?? o.openedAt;
  let sent = false;
  let fired: number | null = null;
  let ready: number | null = null;
  let ran: number | null = null;
  for (const e of log) {
    if (isFire(e)) {
      if (!sent) note('send', opened, e.at);
      sent = true;
      fired ??= e.at;
    } else if (isReady(e)) {
      if (fired != null) note('ready', fired, e.at);
      fired = null;
      ready ??= e.at;
    } else if (isRun(e)) {
      if (ready != null) note('run', ready, e.at);
      ready = null;
      ran = e.at;
    } else if (e.k === 'checkin') {
      note('checkin', ran, e.at);
      ran = null;
    }
  }
  return (Object.keys(GAP_LABELS) as GapKey[])
    .filter((k) => worst[k] != null)
    .map((k) => {
      const mins = Math.round((worst[k]! / MINUTE) * 2) / 2;
      return { key: k, label: GAP_LABELS[k], mins, tone: gapTone(mins, settings[k]) };
    });
}

/** Amber has to come before red; a message when it doesn't (either off is fine). */
export function amberRedProblem(amber: unknown, red: unknown): string | null {
  const a = Number(amber) || 0;
  const r = Number(red) || 0;
  return a > 0 && r > 0 && a >= r ? `Amber (${a} min) has to come before red (${r} min).` : null;
}
