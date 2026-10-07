/**
 * What a table card on My Tables offers next.
 *
 * Green is done where it stands and checks something off; light blue takes
 * the server to the check (or a list) for the next step. "Run", never
 * "fire" and never "pick up": run is the word the room uses, and pick up
 * already means a takeout order.
 */
import { checkedIn, courseWork, lastRun, serverItems, serverOnlyCourse } from '../../../domain/courses';
import { DEFAULT_CONFIG, flag, type DiningConfig } from '../../../domain/config';
import { isSide } from '../../../domain/menu';
import { isDrinkLine } from '../../../domain/routing';
import type { Order } from '../../../domain/types';
import { MINUTE } from '../../../lib/clock';
import { drinkQueue } from '../shared/lines';
import type { StageKey } from '../../../domain/tableStage';

export type CardAction =
  /** Drinks to bring: the server pours them, or they are up at the bar. */
  | { kind: 'drinks'; pour: boolean; upCount: number }
  /** List what the server makes for the course (info only when Expo runs it). */
  | { kind: 'grab'; course: number }
  /** Nothing in the course comes from the cook: mark it served from here. */
  | { kind: 'markServed'; course: number }
  /** Expo runs the course; the server goes to the pass. */
  | { kind: 'readyAtPass'; course: number }
  /** List what the server makes, then run the course. */
  | { kind: 'getAndRun'; course: number }
  | { kind: 'run'; course: number }
  | { kind: 'fire'; course: number; fireAs: number[]; label: string }
  | { kind: 'dessertOnLine' }
  | { kind: 'dessert' }
  | { kind: 'noDessert' }
  /** Ask the table how the course is; `awake` once they have had time to taste it. */
  | { kind: 'checkIn'; course: number; awake: boolean }
  | { kind: 'trivia' }
  | { kind: 'quickClose' }
  | { kind: 'confirmPayment' }
  | { kind: 'takeOrder' }
  | { kind: 'finishOrder'; hasFood: boolean }
  | { kind: 'firedNote' }
  | { kind: 'atBar'; count: number };

export interface CardContext {
  stage: StageKey;
  /** Every diner is a resident on a plan with nothing to charge: Quick close. */
  covered: boolean;
  /** The venue has someone on Expo. */
  hasExpo: boolean;
  /** Minutes after a run before Check in turns green. */
  checkInWakeMin: number;
  now: number;
  cfg?: DiningConfig;
}

/** The actions for a table card, left to right. */
export function cardActions(o: Order, ctx: CardContext): CardAction[] {
  const cfg = ctx.cfg ?? DEFAULT_CONFIG;
  const acts: CardAction[] = [];
  const work = courseWork(o);
  const dq = drinkQueue(o);
  const drinksToGet = dq.pour.length + dq.up.length;
  const hasFood = o.diners.some((d) => d.items.some((i) => !i.cancelled && !isDrinkLine(i, o)));

  if (drinksToGet > 0) acts.push({ kind: 'drinks', pour: dq.pour.length > 0, upCount: dq.up.length });

  const run = work.run;
  const mine = serverItems(o, run, false, cfg);
  const serverOnly = run != null && mine.length > 0 && serverOnlyCourse(o, run, cfg);
  const eatenRun = ctx.stage === 'eat' ? lastRun(o) : null;
  const didCheckIn = checkedIn(o, eatenRun);

  if (run != null && serverOnly) {
    acts.push({ kind: 'grab', course: run }, { kind: 'markServed', course: run });
  } else if (run != null && ctx.hasExpo) {
    acts.push({ kind: 'readyAtPass', course: run });
    if (mine.length) acts.push({ kind: 'grab', course: run });
  } else if (run != null) {
    acts.push(mine.length ? { kind: 'getAndRun', course: run } : { kind: 'run', course: run });
  } else {
    if (eatenRun && didCheckIn) {
      const onTheLine = o.diners.some((d) =>
        d.items.some(
          (i) =>
            i.sent &&
            !i.cancelled &&
            !i.comped &&
            !isDrinkLine(i, o) &&
            !isSide(i.itemId) &&
            i.kitchenState !== 'cleared' &&
            i.kitchenState !== 'scheduled',
        ),
      );
      if (work.fire != null) {
        const label = work.fire >= 3 ? 'Fire dessert' : `Fire C${work.fire}`;
        acts.push({ kind: 'fire', course: work.fire, fireAs: work.fireAs ?? [], label });
      } else if (onTheLine) acts.push({ kind: 'dessertOnLine' });
      else if (!o.noDessert) acts.push({ kind: 'dessert' }, { kind: 'noDessert' });
    } else {
      if (eatenRun && flag(cfg, 'checkIn')) {
        acts.push({
          kind: 'checkIn',
          course: eatenRun.c,
          awake: ctx.now - eatenRun.at >= ctx.checkInWakeMin * MINUTE,
        });
      }
      if (work.fire != null) {
        const label = (eatenRun ? 'Fire C' : 'Fire course ') + work.fire;
        acts.push({ kind: 'fire', course: work.fire, fireAs: work.fireAs ?? [], label });
      }
    }
    if (ctx.stage === 'check') acts.push({ kind: 'trivia' }, ctx.covered ? { kind: 'quickClose' } : { kind: 'confirmPayment' });
    if (ctx.stage === 'seat') acts.push({ kind: 'takeOrder' });
    if (ctx.stage === 'order') acts.push({ kind: 'finishOrder', hasFood });
    if (!acts.length && ctx.stage === 'cook') acts.push({ kind: 'firedNote' });
  }
  if (!drinksToGet && dq.bar.length > 0 && acts.length < 2) acts.push({ kind: 'atBar', count: dq.bar.length });
  return acts;
}
