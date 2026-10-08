/**
 * Temperature log: food-safety checks on the dishes a kitchen serves at each
 * meal, kept the way a health inspector reads them.
 *
 * Every dish is held hot or cold (or not logged at all: bread, cookies and
 * other shelf-stable food). A hot dish must reach its cooking temperature
 * when it goes on the line (165°F poultry and anything reheated, 155°F ground
 * meat and eggs, 145°F fish and whole cuts, 135°F everything else) and stay
 * at 135°F or above while it is held; a cold dish stays at 41°F or below.
 * Each meal has a check when the food goes on the line and one every
 * CHECK_INTERVAL_MIN minutes of service after it. A reading out of range is
 * kept with the corrective action the cook took, and a recheck temperature.
 * A cook can also add an extra check on a dish at any time (a new batch, a
 * re-check after reheating, a spot check): it is judged against the holding
 * target and adds a reading, but is never due, overdue or missed.
 * Dates are "YYYY-MM-DD" in local time.
 */
import { dateOf, isoOf } from './cleaning';

export type TempMeal = 'Breakfast' | 'Lunch' | 'Dinner';
export type HoldType = 'hot' | 'cold' | 'none';
/** What a hot dish is, for the temperature it must be cooked or reheated to. */
export type CookKind = 'reheat' | 'poultry' | 'ground' | 'egg' | 'whole' | 'other';
export type TempAction = 'reheat' | 'chill' | 'discard' | 'recheck';

export const TEMP_MEALS: TempMeal[] = ['Breakfast', 'Lunch', 'Dinner'];

/** Hot food is held at this or above. */
export const HOT_HOLD_F = 135;
/** Cold food is held at this or below. */
export const COLD_HOLD_F = 41;
/** Anything reheated for hot holding reaches this. */
export const REHEAT_F = 165;

/** The minimum cooking temperature for each kind of hot dish, °F. */
export const COOK_MIN_F: Record<CookKind, number> = { reheat: REHEAT_F, poultry: 165, ground: 155, egg: 155, whole: 145, other: HOT_HOLD_F };

export const COOK_LABEL: Record<CookKind, string> = {
  reheat: 'Soup or reheated',
  poultry: 'Poultry',
  ground: 'Ground meat or fish',
  egg: 'Eggs held hot',
  whole: 'Fish, seafood or whole cuts',
  other: 'Cooked vegetables and starches',
};

export const HOLD_LABEL: Record<HoldType, string> = { hot: 'Hot hold', cold: 'Cold hold', none: 'Not logged' };

/** Each meal's service, in minutes after midnight: the line is set at the start. */
export const SERVICE: Record<TempMeal, { start: number; end: number }> = {
  Breakfast: { start: 7 * 60, end: 10 * 60 },
  Lunch: { start: 11 * 60 + 30, end: 14 * 60 },
  Dinner: { start: 16 * 60 + 30, end: 19 * 60 },
};

/** Held food is checked again this often during service. */
export const CHECK_INTERVAL_MIN = 120;
/** A check shows as due from this long before its time... */
export const DUE_EARLY_MIN = 30;
/** ...and overdue this long after it (missed once the meal is over). */
export const GRACE_MIN = 30;

export const ACTION_LABEL: Record<TempAction, string> = {
  reheat: `Reheat to ${REHEAT_F}°F`,
  chill: 'Chill / move to the walk-in',
  discard: 'Discard',
  recheck: 'Rechecked',
};

export interface TempCheck {
  id: string;
  label: string;
  /** "line": as it goes on the line; "hold": during service. */
  kind: 'line' | 'hold';
  /** When it is due, minutes after midnight. */
  due: number;
}

export interface TempTarget {
  /** At or above (hot). */
  min?: number;
  /** At or below (cold). */
  max?: number;
  /** "≥ 165°F". */
  label: string;
}

/** A reading, signed with the cook's PIN. */
export interface TempReading {
  tempF: number;
  at: number;
  staffId: string;
  /** "T. Reyes". */
  by: string;
  /** What was done about a reading out of range. */
  action?: TempAction;
  recheckF?: number;
}

/** Why an extra check was taken. */
export type TempExtraReason = 'batch' | 'recheck' | 'spot' | 'other';

export const EXTRA_REASONS: TempExtraReason[] = ['batch', 'recheck', 'spot', 'other'];

export const EXTRA_REASON_LABEL: Record<TempExtraReason, string> = { batch: 'New batch', recheck: 'Re-check', spot: 'Spot check', other: 'Other' };

/** An extra reading on a dish, taken whenever the cook wants, beyond the meal's checks. */
export interface TempExtraReading extends TempReading {
  id: string;
  reason?: TempExtraReason;
}

/**
 * Where a check stands: ok (in range); out (out of range, with the action
 * taken); due (now); upcoming (later); overdue (late, the meal still on);
 * missed (the meal is over with no reading).
 */
export type TempStatus = 'ok' | 'out' | 'due' | 'upcoming' | 'overdue' | 'missed';

// ─── Dishes ──────────────────────────────────────────────────────────────

/** Shelf-stable bakery and the like: no temperature to keep. */
const NOT_LOGGED =
  /(?<!(egg|spring|cabbage|lobster) )\brolls?\b|\b(knots?|biscuits?|cookies?|brownies?|cupcakes?|muffins?|scones?|croissants?|cereal bars?|crackers?)\b|\bp\.?b\.? ?& ?j|peanut butter|\bbread\b(?! ?(pudding|stuffing))/i;
/** Said hot in the name, which beats a cold word ("Warm Bread Pudding"). */
const SAID_HOT = /\b(warm|hot)\b/i;
const COLD =
  /salad|slaw|yogurt|parfait|pudding|trifle|tiramisu|mousse|cheesecake|jell|gelatin|fruit cup|cut fruit|cottage cheese|deli|sushi|ceviche|gazpacho|chilled|cold|ice cream|sorbet|hummus|cream pie|overnight oats/i;

/**
 * How a dish is held, from its menu category and name: soups, entrées and hot
 * sides hot; salads, cold starters and desserts like pudding cold; bread and
 * bakery not logged. Back Office can override it.
 */
export function inferHold(name: string, category = ''): HoldType {
  if (NOT_LOGGED.test(name)) return 'none';
  if (SAID_HOT.test(name)) return 'hot';
  if (COLD.test(name) || /salad/i.test(category)) return 'cold';
  if (/dessert/i.test(category)) return /cake|pie|tart|crisp|cobbler/i.test(name) ? 'none' : 'cold';
  return 'hot';
}

/** What a hot dish is, for its cooking temperature; soups first, since a soup is reheated whatever is in it. */
export function cookKind(name: string, category = ''): CookKind {
  if (/soup|chowder|bisque|minestrone|broth|chili|gumbo|stew|reheat|leftover/i.test(name) || /soup/i.test(category)) return 'reheat';
  if (/chicken|turkey|duck|poultry|wings?\b|\bhen\b/i.test(name)) return 'poultry';
  if (/burger|ground|meatballs?|meatloaf|sausage|patty|taco meat|sloppy/i.test(name)) return 'ground';
  if (/omelet|\beggs\b|scrambl|quiche|frittata/i.test(name)) return 'egg';
  if (
    /salmon|fish|cod|tilapia|halibut|shrimp|scallop|tuna|trout|pork|carnitas|carne|beef|steak|\bham\b|lamb|veal|roast|brisket|ribs?\b|chops?\b/i.test(
      name,
    )
  )
    return 'whole';
  return 'other';
}

/** "Peach Glazed Chicken" → "peach-glazed-chicken", how readings are kept for a dish. */
export function dishKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Checks and targets ──────────────────────────────────────────────────

/** "4:30 PM" for minutes after midnight. */
export function clockLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** A meal's checks: on the line at the start, then every CHECK_INTERVAL_MIN while service lasts. */
export function mealChecks(meal: TempMeal): TempCheck[] {
  const { start, end } = SERVICE[meal];
  const checks: TempCheck[] = [{ id: 'line', label: 'On the line', kind: 'line', due: start }];
  for (let t = start + CHECK_INTERVAL_MIN, i = 1; t < end; t += CHECK_INTERVAL_MIN, i++)
    checks.push({ id: `mid${i}`, label: 'Mid-service', kind: 'hold', due: t });
  if (checks.length > 2) checks.slice(1).forEach((c, i) => (c.label = `Mid-service ${i + 1}`));
  return checks;
}

export function formatTemp(f: number): string {
  return `${Math.round(f * 10) / 10}°F`;
}

/**
 * What a reading must be: a hot dish reaches its cooking temperature on the
 * line and stays at 135°F or above after; a cold dish stays at 41°F or below.
 */
export function targetFor(hold: HoldType, kind: TempCheck['kind'], cook: CookKind = 'other'): TempTarget {
  if (hold === 'cold') return { max: COLD_HOLD_F, label: `≤ ${COLD_HOLD_F}°F` };
  const min = kind === 'line' ? COOK_MIN_F[cook] : HOT_HOLD_F;
  return { min, label: `≥ ${min}°F` };
}

/** What an extra check must be: the holding target (hot ≥ 135°F, cold ≤ 41°F), never the cook temperature. */
export function extraTarget(hold: HoldType): TempTarget {
  return targetFor(hold, 'hold');
}

export function inRange(target: TempTarget, tempF: number): boolean {
  return (target.min == null || tempF >= target.min) && (target.max == null || tempF <= target.max);
}

/** The corrective actions to offer for a dish out of range. */
export function actionsFor(hold: HoldType): TempAction[] {
  return hold === 'cold' ? ['chill', 'discard', 'recheck'] : ['reheat', 'discard', 'recheck'];
}

/** A temperature a probe could read: 0 to 250°F. */
export function plausibleTemp(f: number): boolean {
  return Number.isFinite(f) && f >= 0 && f <= 250;
}

/** Where a check stands on a date at `nowMs`, given the reading for it (if any). */
export function tempStatus(
  meal: TempMeal,
  check: TempCheck,
  iso: string,
  reading: TempReading | null,
  target: TempTarget,
  nowMs: number,
): TempStatus {
  if (reading) return inRange(target, reading.tempF) ? 'ok' : 'out';
  const now = new Date(nowMs);
  const todayIso = isoOf(now);
  if (iso < todayIso) return 'missed';
  if (iso > todayIso) return 'upcoming';
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins >= SERVICE[meal].end) return 'missed';
  if (mins < check.due - DUE_EARLY_MIN) return 'upcoming';
  return mins < check.due + GRACE_MIN ? 'due' : 'overdue';
}

/** A minute of a date ("YYYY-MM-DD") in ms. */
export function atMinute(iso: string, mins: number): number {
  const d = dateOf(iso);
  d.setMinutes(mins);
  return d.getTime();
}

export interface TempCell {
  check: TempCheck;
  target: TempTarget;
  reading: TempReading | null;
  status: TempStatus;
}

/** An extra reading with its target: in range or out. */
export interface TempExtraCell {
  reading: TempExtraReading;
  target: TempTarget;
  status: 'ok' | 'out';
}

export function extraCell(hold: HoldType, reading: TempExtraReading): TempExtraCell {
  const target = extraTarget(hold);
  return { reading, target, status: inRange(target, reading.tempF) ? 'ok' : 'out' };
}

export interface TempTotals {
  taken: number;
  out: number;
  missed: number;
  overdue: number;
  /** Checks due now or overdue, with no reading yet. */
  open: number;
}

/** Counts for the checks; extra readings add to readings taken and out of range, never to due, overdue or missed. */
export function tempTotals(cells: TempCell[], extras: TempExtraCell[] = []): TempTotals {
  const n = (st: TempStatus) => cells.filter((c) => c.status === st).length;
  return {
    taken: cells.filter((c) => c.reading).length + extras.length,
    out: n('out') + extras.filter((x) => x.status === 'out').length,
    missed: n('missed'),
    overdue: n('overdue'),
    open: n('due') + n('overdue'),
  };
}
