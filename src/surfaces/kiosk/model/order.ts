/**
 * Turning the resident's answers into a real order. It goes through the
 * same store actions as a staff pick up or delivery, so it lands on
 * PU & Delivery, the kitchen screens and Expo unchanged.
 */
import { COMMUNITY_NAME, getItem, mealPlans, rooms } from '../../../data';
import type { DinerBilling } from '../../../domain/billing';
import { defaultSides, shortName } from '../../../domain/menu';
import type { Order, OrderLine, Resident } from '../../../domain/types';
import { formatMoney } from '../../../lib/format';
import type { TextSettings } from '../../../domain/pickupService/settings';
import { fillText, textBody } from '../../../domain/pickupService/texts';
import { minuteLabel, rangeLabel } from '../../../domain/pickupService/windows';
import type { KioskState } from './flow';
import { defaultMods, dishLongName, dishVersions, drinkName, modsFromWords, versionMods, type DishVersion } from '../../../domain/kioskMenu';
import { KIOSK_ROOM } from './times';

/** "Sequoia" (the venue's first name, as residents say it). */
export function kioskVenue(): string {
  return (rooms[KIOSK_ROOM]?.name ?? 'Sequoia').split(/\s*\/\s*/)[0];
}

/** "We bring it to Apt 208" / "Pick up at the Sequoia Dining basket" */
export function kioskPlace(type: KioskState['type'], resident: Resident | null): string {
  return type === 'delivery' ? `We bring it to Apt ${resident?.apt ?? ''}` : `Pick up at the ${kioskVenue()} Dining basket`;
}

/** The ready-made version picked for a build-your-own dish. */
export function chosenVersion(s: Pick<KioskState, 'entree' | 'version'>): DishVersion | null {
  if (!s.entree || !s.version) return null;
  return dishVersions(getItem(s.entree)).find((v) => v.name === s.version) ?? null;
}

/** The main dish as the resident sees it: "Veggie Pizza", "Peach Glazed Chicken Breast". */
export function mainDishName(s: Pick<KioskState, 'entree' | 'version'>): string {
  const v = chosenVersion(s);
  if (v) return v.title;
  const it = getItem(s.entree);
  return it ? dishLongName(it.name) : '';
}

/** Chips and comment as one note: "No onions, Cut up. Extra crispy please" */
export function kioskNote(changes: string[], comment: string): string {
  return [changes.join(', '), comment.trim()].filter(Boolean).join('. ');
}

/** The sides that go with the main dish. */
export function sideIds(s: Pick<KioskState, 'entree' | 'side'>): string[] {
  if (!s.entree || s.side === 'none') return [];
  if (s.side && s.side !== 'keep') return [s.side];
  return defaultSides(s.entree);
}

export interface KioskOrderContext {
  id: string;
  now: number;
  /** "YYYY-MM-DD" today on the demo clock. */
  today: string;
  /** Sick-tray waivers the resident has used this period. */
  sickUsed: number;
}

/** The order the kiosk places. Lines are unsent; the kiosk sends it right after adding it. */
export function buildKioskOrder(s: KioskState, ctx: KioskOrderContext): Order {
  const lines: OrderLine[] = [];
  const v = chosenVersion(s);
  let k = 0;
  const line = (itemId: string, extra: Partial<OrderLine> = {}): OrderLine => ({
    id: `${ctx.id}i${k++}`,
    itemId,
    mods: defaultMods(getItem(itemId)),
    note: '',
    sent: false,
    kitchenState: null,
    ...extra,
  });
  if (s.soup) lines.push(line(s.soup));
  if (s.entree) {
    const it = getItem(s.entree);
    const main = line(s.entree, {
      mods: { ...defaultMods(it), ...modsFromWords(it, s.note), ...versionMods(s.entree, v) },
      note: [v?.title, s.note].filter(Boolean).join(' · '),
      ...(v ? { ver: v.title } : {}),
    });
    lines.push(main);
    const keep = !s.side || s.side === 'keep';
    for (const sid of sideIds(s)) lines.push(line(sid, { autoSide: keep, parentId: main.id }));
  }
  if (s.drink) lines.push(line(s.drink));
  if (s.dessert) lines.push(line(s.dessert));
  // With no main dish, the changes ride on the first line.
  if (!s.entree && s.note && lines.length) lines[0] = { ...lines[0], note: [lines[0].note, s.note].filter(Boolean).join(' · ') };

  const resident = s.resident;
  const delivery = s.type === 'delivery';
  return {
    id: ctx.id,
    queueType: s.type ?? 'pickup',
    room: KIOSK_ROOM,
    server: 'Kiosk',
    source: 'kiosk',
    meal: s.meal ?? 'Dinner',
    readyAt: s.win != null ? minuteLabel(s.win) : undefined,
    openedAt: ctx.now,
    ...(s.date && s.date !== ctx.today ? { forDate: s.date } : {}),
    utensils: !!s.utensils,
    ...(delivery ? { deliveryFeeId: 'df1' } : {}),
    ...(delivery && s.sick && resident
      ? { sickTray: { rid: resident.id, n: ctx.sickUsed + 1, by: 'Resident at the kiosk', at: ctx.now } }
      : {}),
    diners: resident ? [{ id: `${ctx.id}d`, kind: 'resident', refId: resident.id, isGuest: false, seat: 1, items: lines }] : [],
  };
}

/** "Veggie Pizza, no side · Cheeseburger Soup · Iced Tea" pieces for the review. */
export function reviewItems(s: KioskState): string[] {
  const side =
    !s.entree || !s.side || s.side === 'keep' ? '' : s.side === 'none' ? ', no side' : ` with ${dishLongName(getItem(s.side)?.name ?? '').toLowerCase()}`;
  const name = (id: string | null) => (id ? dishLongName(getItem(id)?.name ?? '') : '');
  const drink = s.drink ? getItem(s.drink) : undefined;
  return [s.entree && mainDishName(s) + side, name(s.soup), drink && drinkName(drink), name(s.dessert)].filter((x): x is string => !!x);
}

/** "Dinner today, 6:30 to 6:45 PM, pick up at the Sequoia Dining basket." */
export function reviewWhen(s: KioskState, today: string): string {
  const day = s.date === today ? 'today' : 'tomorrow';
  const where = s.type === 'delivery' ? `delivered to Apt ${s.resident?.apt ?? ''}` : `pick up at the ${kioskVenue()} Dining basket`;
  return `${s.meal} ${day}, ${s.win != null ? rangeLabel(s.win) : ''}, ${where}.`;
}

/** The meal plan in one plain sentence for the review. */
export function planSentence(r: Resident | null, bill: DinerBilling): string {
  const plan = (r && mealPlans[r.plan]) || mealPlans.alacarte;
  const counts = plan.type === 'Monthly' || plan.type === 'Daily';
  const left = Math.max(0, plan.amt - (r?.consumed ?? 0) - 1);
  const leftText = counts && bill.covered ? ` You'll have ${left} meal${left === 1 ? '' : 's'} left${plan.type === 'Daily' ? ' today.' : '.'}` : '';
  if (bill.covered) {
    const extra =
      bill.outOfPlan > 0
        ? `Included in your meal plan, plus ${formatMoney(bill.outOfPlan)}${bill.delivery > 0 && bill.delivery >= bill.outOfPlan ? ' for delivery' : ''} to your apartment.`
        : 'Included in your meal plan.';
    return extra + leftText;
  }
  if (bill.outOfPlan > 0) {
    return `This order adds ${formatMoney(bill.outOfPlan)} to your apartment bill${bill.delivery > 0 ? `, including the ${formatMoney(bill.delivery)} delivery charge.` : '.'}`;
  }
  return counts ? 'Included in your meal plan.' : 'No charge for this order.';
}

/**
 * The copy texted after a kiosk order: one line per dish in kitchen short
 * names, so a usual meal stays near one text (160 characters).
 */
export function kioskTextBody(s: KioskState, o: Order, resident: Resident, bill: DinerBilling, texts: TextSettings, today: string): string {
  const v = chosenVersion(s);
  const lines = (o.diners[0]?.items ?? [])
    .map((x) => {
      const it = getItem(x.itemId);
      if (!it) return '';
      const nm = x.itemId === s.drink ? drinkName(it) : x.itemId === s.entree && v ? v.title : shortName(it.name);
      return `- ${nm}`;
    })
    .filter(Boolean);
  if (s.note) lines.push(`Changes: ${s.note}`);
  if (bill.outOfPlan > 0) lines.push(`Extra charge ${formatMoney(bill.outOfPlan)} to your apartment.`);
  const where = s.type === 'delivery' ? `, delivered to Apt ${resident.apt}` : `, pick up at the ${kioskVenue()} Dining basket`;
  const when = `${s.date === today ? 'today' : 'tomorrow'}, ${s.win != null ? rangeLabel(s.win) : ''}${where}`;
  return fillText(textBody(texts, 'kioskCopy'), {
    first: resident.name.split(' ')[0],
    name: resident.name,
    meal: String(s.meal ?? 'meal').toLowerCase(),
    venue: `${kioskVenue()} Dining`,
    when,
    items: lines.join('\n') || '- No items',
    apt: resident.apt,
    community: COMMUNITY_NAME,
  });
}
