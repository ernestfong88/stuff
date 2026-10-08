/**
 * Kitchen routing: which screen a line goes to and what state it starts in.
 *
 * Food has three routes:
 *   kds   the cook line makes it, then expo runs it
 *   expo  the server makes it (house salad, soup, a plated dessert); it is
 *         ready the moment it is sent, so a course waits only on the cook
 *   none  never reaches a kitchen screen (alcohol, fees)
 * The recipe carries the default and a venue can override it, because the
 * same soup is made on the line at one community and pulled from a warmer
 * at another.
 *
 * Drinks never take a course. Non-alcoholic ones go to the server (pour);
 * alcohol goes to the bar where the venue has one, elsewhere the server
 * pours it too.
 */
import { getItem } from '../data';
import { DEFAULT_CONFIG, type DiningConfig } from './config';
import { isAlcohol, isDrink, isSide } from './menu';
import type { KitchenState, Order, OrderLine } from './types';

export type FoodRoute = 'kds' | 'expo' | 'none';
export type DrinkRoute = 'bar' | 'server';

/** Name patterns of dishes the server makes by default. */
export const ROUTE_EXPO_PATTERNS: readonly RegExp[] = [
  /soup|chowder|bisque/i,
  /salad/i,
  /fruit cup|parfait|yogurt/i,
  /coleslaw|potato chips|avocado slices/i,
];
/** Name patterns that always go to the cook line (checked first: "salad sandwich" is cooked). */
export const ROUTE_KDS_PATTERNS: readonly RegExp[] = [/sandwich|melt|wrap|burger|panini|patty/i];

/** Venues with a bar that makes cocktails. */
export const COCKTAIL_ROOMS: readonly string[] = ['bistro'];

const overrideKey = (room: string | undefined, itemId: string) => (room ?? '') + '|' + itemId;

/** __kRouteDefault: the recipe's own route. */
export function defaultFoodRoute(itemId: string): FoodRoute {
  const it = getItem(itemId);
  if (!it) return 'kds';
  if (it.route) return it.route as FoodRoute;
  const c = it.category;
  if (c === 'Alcohol' || c === 'Cocktails' || c === 'Fees') return 'none';
  const name = it.name || '';
  if (ROUTE_KDS_PATTERNS.some((re) => re.test(name))) return 'kds';
  if (ROUTE_EXPO_PATTERNS.some((re) => re.test(name))) return 'expo';
  return 'kds';
}

/**
 * $r / __kRoute: the route for an item in a venue. Drinks are "none" here
 * (they follow drinkRoute). An old "none" override reads as the server
 * making it.
 */
export function foodRoute(itemId: string, room?: string, cfg: DiningConfig = DEFAULT_CONFIG): FoodRoute {
  if (isDrink(itemId)) return 'none';
  const v = cfg.route[overrideKey(room, itemId)];
  if (v === 'none') return 'expo';
  return (v as FoodRoute) || defaultFoodRoute(itemId);
}

/**
 * A line's route: its dish's, except that a side follows its plate. The
 * sides of an entrée the server makes are the server's too, so they never
 * sit on the cook line as an orphan ticket.
 */
export function lineFoodRoute(
  line: Pick<OrderLine, 'itemId' | 'parentId'>,
  items: readonly Pick<OrderLine, 'id' | 'itemId'>[],
  room?: string,
  cfg: DiningConfig = DEFAULT_CONFIG,
): FoodRoute {
  const own = foodRoute(line.itemId, room, cfg);
  if (!line.parentId || own !== 'kds' || !isSide(line.itemId)) return own;
  const parent = items.find((p) => p.id === line.parentId);
  return parent && foodRoute(parent.itemId, room, cfg) === 'expo' ? 'expo' : own;
}

/** __kDrinkRouteDefault */
export function defaultDrinkRoute(itemId: string, room?: string): DrinkRoute {
  return isAlcohol(itemId) && room != null && COCKTAIL_ROOMS.includes(room) ? 'bar' : 'server';
}

/**
 * __kDrinkRoute: venue override, else the default. With the Bar screen
 * switched off (its release phase is off) there is no one at a bar, so
 * every drink goes to the server.
 */
export function drinkRoute(itemId: string, room?: string, cfg: DiningConfig = DEFAULT_CONFIG): DrinkRoute {
  if (cfg.barScreen === false) return 'server';
  const v = cfg.route[overrideKey(room, itemId)];
  return v === 'bar' || v === 'server' ? v : defaultDrinkRoute(itemId, room);
}

/** The kitchen state a sent drink starts in. */
export function drinkStartState(itemId: string, room?: string, cfg: DiningConfig = DEFAULT_CONFIG): KitchenState {
  return drinkRoute(itemId, room, cfg) === 'bar' ? 'bar' : 'pour';
}

/** ms: the state a dine-in line takes when it fires. */
export function firedState(itemId: string, room?: string, cfg: DiningConfig = DEFAULT_CONFIG): KitchenState {
  const r = foodRoute(itemId, room, cfg);
  return r === 'expo' ? 'ready' : r === 'none' ? 'cleared' : 'cooking';
}

/** __kQms: the state a pick up / delivery line takes when it fires (nothing skips the pass). */
export function queueFiredState(itemId: string, room?: string, cfg: DiningConfig = DEFAULT_CONFIG): KitchenState {
  return foodRoute(itemId, room, cfg) === 'none' ? 'ready' : firedState(itemId, room, cfg);
}

const stateFor = (r: FoodRoute, queue: boolean): KitchenState => (r === 'kds' ? 'cooking' : r === 'expo' || queue ? 'ready' : 'cleared');

/** The state a line takes when it fires, with sides following their plate (lineFoodRoute). */
export function lineFiredState(
  line: Pick<OrderLine, 'itemId' | 'parentId'>,
  items: readonly Pick<OrderLine, 'id' | 'itemId'>[],
  o: Pick<Order, 'room' | 'queueType'>,
  cfg: DiningConfig = DEFAULT_CONFIG,
): KitchenState {
  return stateFor(lineFoodRoute(line, items, o.room, cfg), !!o.queueType);
}

/**
 * __kDr: a drink line. Pick up and delivery keep drinks on the food path,
 * so an unsent drink there is not treated as one.
 */
export function isDrinkLine(line: OrderLine | null | undefined, order?: Pick<Order, 'queueType'> | null): boolean {
  return !!line && (!!line.drink || (!order?.queueType && isDrink(line.itemId)));
}
