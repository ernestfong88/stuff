/**
 * The manager floor's colour for a table: its stage, or Late once it has
 * waited past the Back Office threshold (Alerts & Timing). The late marks
 * are the same ones Triage uses.
 */
import { now, MINUTE } from '../../../lib/clock';
import { DEFAULT_CONFIG, type DiningConfig } from '../../../domain/config';
import type { Order } from '../../../domain/types';
import { threshold, type ThresholdKey } from '../../../store/serviceConfig';
import { tableStage, type StageKey } from './stage';

export type FloorKey = 'run' | 'cook' | 'late' | 'check' | 'eat' | 'idle';

/** Legend order and words. */
export const FLOOR_KEYS: ReadonlyArray<{ key: FloorKey; label: string }> = [
  { key: 'run', label: 'Ready to run' },
  { key: 'cook', label: 'Fired' },
  { key: 'late', label: 'Late' },
  { key: 'check', label: 'Ready to close' },
  { key: 'eat', label: 'Eating' },
  { key: 'idle', label: 'Open' },
];

const LABEL: Record<FloorKey, string> = Object.fromEntries(FLOOR_KEYS.map((k) => [k.key, k.label])) as Record<FloorKey, string>;

/** Triage's chip words, which say a little more than the floor legend. */
export const STAGE_WORDS: Record<StageKey, string> = {
  run: 'Ready to run',
  cook: 'Fired',
  check: 'Ready to close',
  eat: 'Eating',
  order: 'Ordering',
  seat: 'Seated',
};

export type ThresholdFn = (key: ThresholdKey) => number;

/** __kLateBy: has a table in this stage waited past its alert threshold? */
export function isLate(stage: StageKey, mins: number, o: Order, t: ThresholdFn = threshold): boolean {
  switch (stage) {
    case 'run':
      return mins >= t('passLate');
    case 'cook':
      return mins >= t('floorCook');
    case 'eat':
      return mins >= t('eatLate');
    case 'seat':
    case 'order':
      return !o.diners.some((d) => d.items.some((l) => l.sent)) && mins >= t('seatLate');
    default:
      return false;
  }
}

export interface FloorState {
  key: FloorKey;
  /** The stage behind the colour (a late table keeps its real stage here). */
  stage: StageKey;
  since: number;
  /** Word on the tile: the legend word, or "Time to close". */
  word: string;
}

/** __kMgrState */
export function floorState(o: Order, cfg: DiningConfig = DEFAULT_CONFIG, t: ThresholdFn = threshold): FloorState {
  const st = tableStage(o, cfg);
  const mins = (now() - st.since) / MINUTE;
  const key: FloorKey = isLate(st.key, mins, o, t)
    ? 'late'
    : st.key === 'run' || st.key === 'cook' || st.key === 'check' || st.key === 'eat'
      ? st.key
      : 'idle';
  const word = st.key === 'check' && mins >= t('closeLate') ? 'Time to close' : LABEL[key];
  return { key, stage: st.key, since: st.since, word };
}
