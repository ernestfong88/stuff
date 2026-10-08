/**
 * Temperature log: each kitchen's food temperatures at every meal, who took
 * each one with their PIN, and what was done when one was out of range.
 *
 * The dishes are what the kitchen serves that meal, from the same source as
 * Production: the day's menu cycle items and the venue's every-day dishes
 * (productionDay). Each is held hot or cold as its name and category suggest
 * (domain/tempLog inferHold) unless Back Office set it; dishes not logged
 * (bread, cookies) are left out. Prep can add a dish that isn't on the menu
 * for one meal. Production Prep takes the readings; Back Office (Temperature
 * Log) reads them a day at a time.
 *
 * ── Reading (pure; pass the state from useTempLog()) ─────────────────────
 *   tempDishes(state, venueId, iso, meal) → TempDish[]          (hot first, then cold)
 *   mealLog(state, venueId, iso, meal, at?) → MealLog            (every dish's checks, with readings and status)
 *   menuDishesAround(state, venueId, iso, days) → TempDish[]     (every dish served in the days before and after; for Targets)
 *
 * ── Writing (sync to every open tab) ─────────────────────────────────────
 *   recordTemp(venueId, iso, meal, dishKey, checkId, {tempF, action?, recheckF?}, staffId, name)
 *   addTempDish(venueId, iso, meal, name, hold)
 *   setDishHold(venueId, name, hold | null)        (null goes back to the inferred one)
 *   resetTempLog()
 *
 * Seed readings (the past week and today's meals so far) come from the demo
 * clock and never show a time later than now. A few are out of range, with
 * the action the cook took; a few checks were missed.
 */
import { dateOf, isoOf, shortName } from '../domain/cleaning';
import {
  COOK_MIN_F,
  SERVICE,
  atMinute,
  cookKind,
  dishKey,
  inferHold,
  mealChecks,
  targetFor,
  tempStatus,
  type CookKind,
  type HoldType,
  type TempAction,
  type TempCell,
  type TempMeal,
  type TempReading,
} from '../domain/tempLog';
import { DAY, now } from '../lib/clock';
import { uid } from '../lib/id';
import { createSharedStore, useShared } from '../lib/sharedStore';
import { kitchenCrew } from './cleaning';
import { productionDay, seedHash } from './production';

export interface TempDish {
  key: string;
  name: string;
  /** Menu category ("Entrees", "Any Day"), or "Added" for a dish added on the tablet. */
  category: string;
  hold: HoldType;
  /** What its name and category suggest; `hold` differs when Back Office set it. */
  inferred: HoldType;
  cook: CookKind;
  /** Added on the prep tablet for this meal. */
  added?: boolean;
}

export interface DishLog {
  dish: TempDish;
  cells: TempCell[];
}

export interface MealLog {
  meal: TempMeal;
  dishes: DishLog[];
}

interface AddedDish {
  key: string;
  name: string;
  hold: HoldType;
}

type StoredReading = TempReading | { off: true };

export interface TempLogState {
  /** "venue|iso|meal|dishKey|checkId" → the reading; `{off: true}` hides a seed one. */
  readings: Record<string, StoredReading>;
  /** "venue|iso|meal" → dishes added on the tablet for that meal. */
  added: Record<string, AddedDish[]>;
  /** "venue|dishKey" → how Back Office says the dish is held. */
  holds: Record<string, HoldType>;
}

export const tempLogStore = createSharedStore<TempLogState>(() => ({ readings: {}, added: {}, holds: {} }), {
  persistKey: 'kisco_templog_v1',
  channel: 'kisco-templog',
});

export function useTempLog(): TempLogState {
  return useShared(tempLogStore);
}

export function resetTempLog(): void {
  tempLogStore.reset();
}

const readingKey = (venueId: string, iso: string, meal: TempMeal, key: string, checkId: string) => `${venueId}|${iso}|${meal}|${key}|${checkId}`;
const mealKey = (venueId: string, iso: string, meal: TempMeal) => `${venueId}|${iso}|${meal}`;
const holdKey = (venueId: string, key: string) => `${venueId}|${key}`;

// ─── Dishes ──────────────────────────────────────────────────────────────

/** Days from today (demo clock) to a date: -1 yesterday. */
function offsetOf(iso: string, at = now()): number {
  return Math.round((dateOf(iso).getTime() - dateOf(isoOf(new Date(at))).getTime()) / DAY);
}

function toDish(state: TempLogState, venueId: string, name: string, category: string, added?: boolean): TempDish {
  const key = dishKey(name);
  const inferred = inferHold(name, category);
  return { key, name, category, inferred, hold: state.holds[holdKey(venueId, key)] ?? inferred, cook: cookKind(name, category), added };
}

/** Everything on the menu at a meal, logged or not, once each. */
function menuDishes(state: TempLogState, venueId: string, iso: string, meal: TempMeal): TempDish[] {
  const seen = new Set<string>();
  return productionDay(venueId, offsetOf(iso))
    .rows.filter((r) => r.meal === meal)
    .map((r) => toDish(state, venueId, r.name, r.category))
    .filter((d) => !seen.has(d.key) && !!seen.add(d.key));
}

/** The dishes logged at a meal: the menu's hot and cold dishes and any added on the tablet, hot first. */
export function tempDishes(state: TempLogState, venueId: string, iso: string, meal: TempMeal): TempDish[] {
  const menu = menuDishes(state, venueId, iso, meal);
  const added = (state.added[mealKey(venueId, iso, meal)] ?? [])
    .filter((a) => !menu.some((d) => d.key === a.key))
    .map((a) => ({ ...toDish(state, venueId, a.name, 'Added', true), hold: a.hold }));
  const list = [...menu, ...added].filter((d) => d.hold !== 'none');
  return [...list.filter((d) => d.hold === 'hot'), ...list.filter((d) => d.hold === 'cold')];
}

/** Every dish a kitchen serves in the `days` before and after a date, A to Z, logged or not: what Back Office sets hot or cold. */
export function menuDishesAround(state: TempLogState, venueId: string, iso: string, days: number): TempDish[] {
  const byKey = new Map<string, TempDish>();
  const from = offsetOf(iso);
  for (let o = from - days; o <= from + days; o++) {
    for (const r of productionDay(venueId, o).rows) {
      const dish = toDish(state, venueId, r.name, r.category);
      if (!byKey.has(dish.key)) byKey.set(dish.key, dish);
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Seed ────────────────────────────────────────────────────────────────

/** How many days back the seed goes. */
const SEED_DAYS = 6;

/**
 * The crew's readings over the last week, up to now: every check taken on
 * time and in range, but for a few the demo shows. Yesterday's dinner had a
 * hot dish drop below 135°F (reheated, then 168°F); two days ago a cold dish
 * at lunch read 45°F (moved to the walk-in, then 38°F); today at lunch a
 * cold dish read 44°F and was thrown out. Three days ago one dinner check
 * was missed, now and then another is, and at the meal on now the last hot
 * dish hasn't gone on the line yet.
 */
function seedMeal(venueId: string, iso: string, meal: TempMeal, dishes: TempDish[], at: number): Map<string, TempReading> {
  const out = new Map<string, TempReading>();
  const back = -offsetOf(iso, at);
  const crew = kitchenCrew();
  if (back < 0 || back > SEED_DAYS || !crew.length) return out;
  const hot = dishes.filter((d) => d.hold === 'hot' && !d.added);
  const cold = dishes.filter((d) => d.hold === 'cold' && !d.added);
  const pick = (list: TempDish[]) => list[seedHash(venueId + iso + meal) % Math.max(1, list.length)]?.key;
  const nowMins = new Date(at).getHours() * 60 + new Date(at).getMinutes();
  const lastHot = hot[hot.length - 1]?.key;
  for (const dish of [...hot, ...cold]) {
    for (const check of mealChecks(meal)) {
      const h = seedHash(`${venueId}|${iso}|${meal}|${dish.key}|${check.id}`);
      if (back > 0 && h % 47 === 0) continue;
      if (back === 3 && meal === 'Dinner' && check.kind === 'hold' && dish === dishes[dishes.length - 1]) continue;
      if (back === 0 && check.kind === 'line' && dish.key === lastHot && nowMins < SERVICE[meal].end) continue;
      const time = atMinute(iso, check.due - (check.kind === 'line' ? 15 : 10) + (h % 14));
      if (time > at) continue;
      const by = crew[(h >> 3) % crew.length];
      let tempF: number;
      let action: TempAction | undefined;
      let recheckF: number | undefined;
      if (dish.hold === 'cold') tempF = 34 + (h % 6);
      else tempF = check.kind === 'line' ? COOK_MIN_F[dish.cook] + 4 + (h % 12) : 141 + (h % 22);
      if (check.kind === 'hold') {
        if (back === 1 && meal === 'Dinner' && dish.key === pick(hot.slice(1))) [tempF, action, recheckF] = [128, 'reheat', 168];
        if (back === 2 && meal === 'Lunch' && dish.key === pick(cold)) [tempF, action, recheckF] = [45, 'chill', 38];
        if (back === 0 && meal === 'Lunch' && dish.key === cold[cold.length - 1]?.key) [tempF, action] = [44, 'discard'];
      }
      out.set(`${dish.key}|${check.id}`, { tempF, at: time, staffId: by.id, by: by.short, action, recheckF });
    }
  }
  return out;
}

// ─── A meal's log ────────────────────────────────────────────────────────

/** Every dish at a meal with its checks: the target, the reading (stored, else the seed's) and where it stands at `at`. */
export function mealLog(state: TempLogState, venueId: string, iso: string, meal: TempMeal, at = now()): MealLog {
  const dishes = tempDishes(state, venueId, iso, meal);
  const seed = seedMeal(venueId, iso, meal, dishes, at);
  const checks = mealChecks(meal);
  return {
    meal,
    dishes: dishes.map((dish) => ({
      dish,
      cells: checks.map((check) => {
        const target = targetFor(dish.hold, check.kind, dish.cook);
        const stored = state.readings[readingKey(venueId, iso, meal, dish.key, check.id)];
        const reading = stored ? ('off' in stored ? null : stored) : (seed.get(`${dish.key}|${check.id}`) ?? null);
        return { check, target, reading, status: tempStatus(meal, check, iso, reading, target, at) };
      }),
    })),
  };
}

// ─── Writing ─────────────────────────────────────────────────────────────

/** Record a reading as the person whose PIN was entered. */
export function recordTemp(
  venueId: string,
  iso: string,
  meal: TempMeal,
  key: string,
  checkId: string,
  r: { tempF: number; action?: TempAction; recheckF?: number },
  staffId: string,
  name: string,
): void {
  const reading: TempReading = { tempF: r.tempF, at: now(), staffId, by: shortName(name) };
  if (r.action) reading.action = r.action;
  if (r.recheckF != null) reading.recheckF = r.recheckF;
  tempLogStore.set((s) => ({ ...s, readings: { ...s.readings, [readingKey(venueId, iso, meal, key, checkId)]: reading } }));
}

/** Add a dish that isn't on the menu to one meal's log; returns its key. */
export function addTempDish(venueId: string, iso: string, meal: TempMeal, name: string, hold: Exclude<HoldType, 'none'>): string {
  const key = dishKey(name) || uid('dish-');
  const k = mealKey(venueId, iso, meal);
  tempLogStore.set((s) => ({
    ...s,
    added: { ...s.added, [k]: [...(s.added[k] ?? []).filter((a) => a.key !== key), { key, name: name.trim(), hold }] },
  }));
  return key;
}

/** Say how a dish is held at a kitchen; null goes back to what its name suggests. */
export function setDishHold(venueId: string, name: string, hold: HoldType | null): void {
  tempLogStore.set((s) => {
    const holds = { ...s.holds };
    if (hold) holds[holdKey(venueId, dishKey(name))] = hold;
    else delete holds[holdKey(venueId, dishKey(name))];
    return { ...s, holds };
  });
}
