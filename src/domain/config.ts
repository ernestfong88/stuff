/**
 * Community and venue settings that change how dining logic behaves.
 *
 * In the prototype these lived in the Back Office config blob (__KCFG) and
 * the venue kitchen settings (__KVenue). Only the parts the domain logic
 * reads are modelled here; every helper that depends on them takes a
 * DiningConfig argument defaulting to DEFAULT_CONFIG, so the logic stays
 * pure and testable. The live, editable copy is src/store/config.ts.
 */
import type { MealName } from './types';

/**
 * When the next course fires:
 *   off     every course fires together
 *   expo    once the prior course is served (default)
 *   timer5  5 / 8 minutes after the prior course fired
 *   manual  only when a server or expo fires it
 * Every mode has a 15 minute backup counted from when the prior course was
 * run, so nothing stalls; dessert always waits for that backup or a manual fire.
 */
export type CourseMode = 'off' | 'expo' | 'timer5' | 'timer8' | 'manual';

export const COURSE_MODES: ReadonlyArray<{ id: CourseMode; label: string; short: string }> = [
  { id: 'off', label: 'Off, all courses fire together', short: 'off' },
  { id: 'expo', label: 'Served fires next', short: 'until the prior course is served' },
  { id: 'timer5', label: 'Timed, 5 min', short: 'timed 5m' },
  { id: 'timer8', label: 'Timed, 8 min', short: 'timed 8m' },
  { id: 'manual', label: 'Server or Expo fires', short: 'until fired, backup 15m' },
];

/** Feature switches. A flag that is not set counts as on. */
export type FlowFlag =
  | 'checkIn'
  | 'dessert'
  | 'appToEntree'
  | 'entreeNext'
  | 'dessertNext'
  | 'freeDeliveryComp'
  | 'shortServer'
  | 'shortKitchen'
  | 'hideDefaults'
  | 'hospiceAuto';

export interface HospiceStatus {
  on: boolean;
  /** "YYYY-MM-DD" */
  since: string;
  note: string;
  by?: string;
  at?: number;
  log: Array<{ on: boolean; by: string; at: number }>;
}

export interface DiningConfig {
  flow: Partial<Record<FlowFlag, boolean>>;
  /** Coursing per venue and meal; missing means "expo". */
  course: Record<string, Partial<Record<MealName, CourseMode>>>;
  /** Kitchen route overrides keyed "room|itemId": kds, expo, bar or server. */
  route: Record<string, string>;
  /** Show an entrée's default sides as their own lines. */
  defaultSidesOnLine: boolean;
  /** Corkage per venue; on by default at $10 a bottle. */
  corkage: Record<string, { on?: boolean; amt?: number }>;
  /** Sick-tray waiver allowance per community; on with 3 a month by default. */
  sick: Record<string, { on?: boolean; allow?: number }>;
  /** Hospice status set in Back Office, overriding the seed. */
  hospice: Record<string, HospiceStatus>;
  /** Short operational names set in Back Office, by full item name. */
  shortNames: Record<string, string>;
  /** Minutes to pack a pick up / delivery, added to the ticket time for the fire lead. */
  pickupPackMinutes: number;
}

export const DEFAULT_CONFIG: DiningConfig = {
  flow: {},
  course: {},
  route: {},
  defaultSidesOnLine: true,
  corkage: {},
  sick: {},
  hospice: {},
  shortNames: {},
  pickupPackMinutes: 5,
};

/** __kF: a flow flag is on unless it was switched off. */
export function flag(cfg: DiningConfig, key: FlowFlag): boolean {
  return cfg.flow[key] !== false;
}
