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
 *   off     Fire all: every course fires together
 *   expo    Fire on drop: once the prior course is dropped at the table (default)
 *   timer5  Auto-fire +5 / +8: 5 / 8 minutes after the prior course fired
 *   manual  Manual fire: only when a server or expo fires it
 * Every mode has a 15 minute backup counted from when the prior course was
 * run, so nothing stalls; dessert always waits for that backup or a manual fire.
 */
export type CourseMode = 'off' | 'expo' | 'timer5' | 'timer8' | 'manual';

export const COURSE_MODES: ReadonlyArray<{ id: CourseMode; label: string; short: string }> = [
  { id: 'off', label: 'Fire all', short: 'fire all' },
  { id: 'expo', label: 'Fire on drop', short: 'fire on drop' },
  { id: 'timer5', label: 'Auto-fire +5', short: 'auto-fire +5' },
  { id: 'timer8', label: 'Auto-fire +8', short: 'auto-fire +8' },
  { id: 'manual', label: 'Manual fire', short: 'manual fire, backup 15m' },
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
  | 'hospiceAuto'
  | 'usuals';

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
  /** What one meal credit covers and how extras are charged (HO Settings, Meal Credits). */
  mealCredit: MealCreditRules;
  /** Residents can put a guest's meal on their own meal credit, per community. */
  guestCredit: Record<string, boolean>;
  /**
   * How orders reach the kitchen. "printers": the whole ticket prints when
   * the server sends it, every course at once, and nothing tracks it after
   * (no cooking, ready or served statuses). "kds": kitchen screens and expo
   * track each plate. Missing means "kds".
   */
  kitchenMode?: KitchenMode;
}

export type KitchenMode = 'kds' | 'printers';

/** Printer mode: tickets print whole and nothing is tracked after the send. */
export const printerMode = (cfg: Pick<DiningConfig, 'kitchenMode'> = DEFAULT_CONFIG): boolean => cfg.kitchenMode === 'printers';

/** What one meal credit covers. */
export interface MealCreditRules {
  starters: number;
  entrees: number;
  sides: number;
  desserts: number;
  /** Sides past the allowance are always charged à la carte (else they can use another credit). */
  extraSidesAla: boolean;
  /** Other items past one credit: use another credit, or charge à la carte. The server can change it per line. */
  overflow: 'credit' | 'ala';
}

export const DEFAULT_MEAL_CREDIT: MealCreditRules = { starters: 1, entrees: 1, sides: 2, desserts: 1, extraSidesAla: true, overflow: 'credit' };

/** Communities where guest meal credits are on until someone changes it. */
const GUEST_CREDIT_DEFAULT_ON: readonly string[] = ['The Fountains'];

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
  mealCredit: DEFAULT_MEAL_CREDIT,
  guestCredit: {},
};

/** The meal credit rules, with defaults for anything a saved copy lacks. */
export function mealCreditRules(cfg: DiningConfig = DEFAULT_CONFIG): MealCreditRules {
  return { ...DEFAULT_MEAL_CREDIT, ...cfg.mealCredit };
}

/** Residents at a community can use their meal credits for guests. */
export function guestCreditOn(cfg: DiningConfig, community: string): boolean {
  return cfg.guestCredit?.[community] ?? GUEST_CREDIT_DEFAULT_ON.includes(community);
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "1 starter + 1 entrée + 2 sides + 1 dessert per credit · a 3rd side and added proteins are à la carte" */
export function mealCreditText(r: MealCreditRules): string {
  const parts = [count(r.starters, 'starter', 'starters'), count(r.entrees, 'entrée', 'entrées'), count(r.sides, 'side', 'sides'), count(r.desserts, 'dessert', 'desserts')].filter(
    (t) => !t.startsWith('0 '),
  );
  const nth = r.sides + 1;
  const ord = nth === 1 ? '1st' : nth === 2 ? '2nd' : nth === 3 ? '3rd' : `${nth}th`;
  const extras = r.extraSidesAla ? `a ${ord} side and added proteins are à la carte` : 'added proteins are à la carte';
  return `${parts.join(' + ')} per credit · ${extras} · side swaps are free`;
}

/** __kF: a flow flag is on unless it was switched off. */
export function flag(cfg: DiningConfig, key: FlowFlag): boolean {
  return cfg.flow[key] !== false;
}
