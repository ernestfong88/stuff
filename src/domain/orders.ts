/**
 * Check-level helpers: who is at the table, table status, holds, item
 * availability, allergen conflicts and the small naming helpers screens use.
 */
import { getAssociate, getItem, getResident, getTable } from '../data';
import { now } from '../lib/clock';
import { foodConflicts, type AvoidSource, type FoodConflict } from './allergens';
import { DEFAULT_CONFIG, type DiningConfig } from './config';
import { isDrink, isSide, itemCourse, itemLabel } from './menu';
import type { Associate, Diner, MealName, ModSelection, Order, OrderLine, QueueType, Resident } from './types';

// ─── Diners ──────────────────────────────────────────────────────────────

type DinerRef = Pick<Diner, 'kind' | 'refId'>;

/**
 * vt: the resident or associate record behind a diner. A guest is seated
 * against the resident who brought them, so this finds the host.
 */
export function dinerPerson(d: DinerRef): Resident | Associate | undefined {
  return d.kind === 'resident' ? getResident(d.refId) : getAssociate(d.refId);
}

/** Ue: the name to show for a diner: the guest's own name, the person's, or "Guest". */
export function dinerName(d: (DinerRef & Partial<Pick<Diner, 'isGuest' | 'guestName'>>) | null | undefined): string {
  if (d?.isGuest && d.guestName) return d.guestName;
  return (d && dinerPerson(d)?.name) || 'Guest';
}

/** od: number of lines on a check. */
export function lineCount(o: Order | null | undefined): number {
  return o ? o.diners.reduce((n, d) => n + d.items.length, 0) : 0;
}

/** Xg: anything rung in but not sent (and not on hold). */
export function hasUnsent(o: Order | null | undefined): boolean {
  return !!o?.diners.some((d) => d.items.some((i) => !i.sent && !i.hold));
}

/** em: unsent lines on hold (a side held with its plate counts with the plate). */
export function heldCount(o: Order | null | undefined): number {
  const own = (i: OrderLine, items: OrderLine[]) => !items.some((p) => p.id === i.parentId && !p.sent && p.hold);
  return o?.diners.reduce((n, d) => n + d.items.filter((i) => !i.sent && i.hold && own(i, d.items)).length, 0) ?? 0;
}

/** __kFindLine */
export function findLine(o: Order | null | undefined, lineId: string): { diner: Diner; line: OrderLine } | null {
  for (const diner of o?.diners ?? []) for (const line of diner.items) if (line.id === lineId) return { diner, line };
  return null;
}

/** __kLead: the first resident's first name and how many more are at the table. */
export function leadDiner(o: Order): { name: string; more: number } | null {
  const ds = o.diners ?? [];
  if (!ds.length) return null;
  const first = ds.find((d) => d.kind === 'resident' && !d.isGuest) ?? ds[0];
  return { name: dinerName(first).split(' ')[0], more: ds.length - 1 };
}

/** __kNamesOf: "Ruth, Harold" */
export function namesOf(o: Order): string {
  return (o.diners ?? []).map((d) => dinerName(d).split(' ')[0]).join(', ');
}

// ─── Table status ────────────────────────────────────────────────────────

export type TableStatus = 'open' | 'seated' | 'cooking' | 'ready';

/**
 * sl: open (no one seated), seated (nothing in the kitchen), cooking, or
 * ready (every plate still out is at the pass).
 */
export function tableStatus(o: Order | null | undefined): TableStatus {
  if (!o || o.diners.length === 0) return 'open';
  const sent = o.diners.flatMap((d) => d.items.filter((i) => i.sent));
  if (sent.length === 0) return 'seated';
  const live = sent.filter((i) => i.kitchenState !== 'cleared');
  if (live.length === 0) return 'seated';
  return live.every((i) => i.kitchenState === 'ready') ? 'ready' : 'cooking';
}

/** Hr: floor colour per status (and for a table with lines on hold). */
export const TABLE_STATUS_COLORS: Record<TableStatus | 'hold', string> = {
  open: '#145785',
  seated: '#C38A51',
  cooking: '#B23B2E',
  ready: '#5D7545',
  hold: '#C38A51',
};

/** vh: unsent held lines and how many minutes the oldest has waited. */
export function holdInfo(o: Order | null | undefined): { count: number; mins: number } | null {
  if (!o) return null;
  const held = o.diners.flatMap((d) => d.items.filter((i) => !i.sent && i.hold));
  if (held.length === 0) return null;
  const since = Math.min(...held.map((i) => i.holdAt || now()));
  return { count: held.length, mins: Math.max(0, Math.floor((now() - since) / 60_000)) };
}

/**
 * Ot: stamp when every live plate reached the pass, and clear the stamp
 * when one goes back. Sides, comped, cancelled, held and run lines don't count.
 */
export function stampReady(o: Order): Order {
  const live = o.diners.flatMap((d) =>
    d.items.filter(
      (i) =>
        i.sent &&
        !i.comped &&
        !i.cancelled &&
        !isSide(i.itemId) &&
        i.kitchenState !== 'scheduled' &&
        i.kitchenState !== 'cleared',
    ),
  );
  const allReady = live.length > 0 && live.every((i) => i.kitchenState === 'ready');
  if (allReady && !o.readyStampAt) return { ...o, readyStampAt: now() };
  if (!allReady && o.readyStampAt) return { ...o, readyStampAt: null };
  return o;
}

// ─── Menu against the floor ──────────────────────────────────────────────

/**
 * tm: what in the line's item the person must avoid, from their allergies
 * and diets (see domain/allergens: free text is matched by meaning, not
 * spelling).
 */
export function allergenConflicts(line: Pick<OrderLine, 'itemId'>, person: AvoidSource | null | undefined): FoodConflict[] {
  return foodConflicts(getItem(line.itemId), person);
}

/** nm: how many of a limited item are left, counting every line on the open checks. Null when unlimited. */
export function availableCount(itemId: string, orders: Order[]): number | null {
  const it = getItem(itemId);
  if (!it || it.avail == null) return null;
  let used = 0;
  for (const o of orders) for (const d of o.diners) for (const i of d.items) if (i.itemId === itemId) used++;
  return Math.max(0, it.avail - used);
}

// ─── Checks sharing a table ──────────────────────────────────────────────

/**
 * __kAddCheck: a party that sits down later at the same table gets its own
 * check. Checks sharing a table are lettered A, B, C. The first check is only
 * lettered once a second one opens, and a letter never changes after that,
 * so a ticket on the rail never gets relabelled under the cook.
 */
export function addCheck(list: Order[], o: Order): Order[] {
  const same = (x: Order) => x.tableId === o.tableId && !x.queueType;
  const siblings = list.filter(same);
  if (!siblings.length) return [...list, o];
  const used = siblings.map((x) => x.checkTag || 'A');
  const tag = 'ABCDEFGHJK'.split('').find((c) => !used.includes(c)) ?? 'Z';
  return [...list.map((x) => (same(x) && !x.checkTag ? { ...x, checkTag: 'A' } : x)), { ...o, checkTag: tag }];
}

export const QUEUE_TYPE_LABELS: Record<QueueType | 'associate', string> = {
  delivery: 'Delivery',
  pickup: 'Pick Up',
  associate: 'Associate Meal',
};

/** __kTableName: "SQ 7B", or "Pick Up" / "Delivery" / "Associate Meal". */
export function tableName(o: Order | null | undefined): string {
  if (!o) return '';
  if (o.queueType) return QUEUE_TYPE_LABELS[o.assoc ? 'associate' : o.queueType];
  return (getTable(o.tableId)?.label || 'Table') + (o.checkTag || '');
}

// ─── Lines and send text ─────────────────────────────────────────────────

/** __kCourseOf: a line's course, numbered the way the status line does. */
export function lineCourse(line: Pick<OrderLine, 'course' | 'courseOverride' | 'itemId'>): number {
  return line.course || line.courseOverride || itemCourse(line.itemId);
}

/** __kPlateLines: plates (no sides, no cancelled) that are sent, or waiting to be. */
export function plateLines(o: Order, sent: boolean): OrderLine[] {
  return (o.diners ?? []).flatMap((d) =>
    d.items.filter(
      (i) => (sent ? i.sent : !i.sent && !i.hold) && !i.autoSide && !i.cancelled && !isSide(i.itemId),
    ),
  );
}

/** __kSendText: "Sent 4 plates (C1, C2) and 2 drinks" */
export function sendText(lines: OrderLine[]): string {
  const drink = (i: OrderLine) => !!i.drink || isDrink(i.itemId);
  const drinks = lines.filter(drink);
  const food = lines.filter((i) => !drink(i));
  const courses = [...new Set(food.map(lineCourse))].sort((a, b) => a - b);
  const parts = [
    food.length ? `${food.length} plate${food.length === 1 ? '' : 's'} (C${courses.join(', C')})` : '',
    drinks.length ? `${drinks.length} drink${drinks.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return 'Sent ' + (parts.join(' and ') || 'the check');
}

/** "Pork Chop for Ruth Bell" */
export function lineLabel(o: Order, lineId: string, cfg: DiningConfig = DEFAULT_CONFIG): string {
  const f = findLine(o, lineId);
  return f ? `${itemLabel(f.line.itemId, cfg)} for ${dinerName(f.diner)}` : 'a line';
}

// ─── Learned favourites ──────────────────────────────────────────────────

export interface LearnedFavorite {
  itemId: string;
  mods: ModSelection;
  note: string;
  /** Times ordered. */
  n: number;
  lastAt: number;
}

/**
 * de / learnedFavorites: a resident's four most ordered item + modifier
 * combinations from closed checks, optionally for one meal only.
 */
export function learnedFavorites(history: Order[], residentId: string, meal?: MealName): LearnedFavorite[] {
  const byKey: Record<string, LearnedFavorite> = {};
  for (const o of history) {
    const at = o.closedAt || o.openedAt;
    for (const d of o.diners) {
      if (d.kind !== 'resident' || d.refId !== residentId) continue;
      for (const line of d.items) {
        const it = getItem(line.itemId);
        if (!it || (meal && it.meal !== meal)) continue;
        const key = line.itemId + '|' + JSON.stringify(line.mods || {});
        const f = (byKey[key] ??= { itemId: line.itemId, mods: line.mods || {}, note: line.note || '', n: 0, lastAt: at });
        f.n += 1;
        f.lastAt = Math.max(f.lastAt, at);
      }
    }
  }
  return Object.values(byKey)
    .sort((a, b) => b.n - a.n || b.lastAt - a.lastAt)
    .slice(0, 4);
}
