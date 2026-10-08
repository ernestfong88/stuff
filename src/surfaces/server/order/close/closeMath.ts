/**
 * Close & charge: what each person at the table pays and where it goes.
 *
 * Each person leads with one band: the amount and where it lands. The meal
 * plan reads green at $0.00 with the meals left after this one, a charge
 * reads amber with the account or card it lands on, and a comp reads grey.
 * The demo has no sales tax, so there is no tax line.
 */
import { lineItem } from '../../../../data';
import { alaCarteTotal, dinerBilling, linePrice, type DinerBilling } from '../../../../domain/billing';
import { DEFAULT_CONFIG, mealCreditRules, type DiningConfig, type MealCreditRules } from '../../../../domain/config';
import { dinerName, dinerPerson } from '../../../../domain/orders';
import type { Diner, Order, OrderLine, Resident } from '../../../../domain/types';
import { isHospiceDiner } from '../../../../domain/waivers';
import { residentPlan } from '../../../backoffice/kit/residentRecords';
import { formatMoney } from '../../../../lib/format';
import { creditKind, isExtraSide, type CreditKind } from '../checkLines';

/** How a diner's meal is counted: meal credits, all à la carte, or comped by a manager. */
export type PlanMode = 'count' | 'alacarte' | 'comp';

/** Order type per diner; the last four are no charge. */
export type DropType = 'dinein' | 'pickup' | 'delivery' | 'assoc' | 'sick' | 'nocharge' | 'hospice';
export const NO_CHARGE_DROPS: Partial<Record<DropType, string>> = {
  assoc: 'Associate Meal',
  sick: 'Sick delivery',
  nocharge: 'No Charge',
  hospice: 'Hospice',
};

export type PayHow = 'apt' | 'card';
/** How the table pays by card. */
export type TablePay = 'each' | 'one' | 'split';

/** How many of each kind one credit covers. */
function perCredit(r: MealCreditRules): Record<CreditKind, number> {
  return { app: r.starters, entree: r.entrees, side: r.sides, dessert: r.desserts };
}

export interface CreditUse {
  diner: Diner;
  /** Lines past what one credit covers. */
  overflow: OrderLine[];
  /** Credits this meal uses. */
  credits: number;
  /** Overflow lines charged à la carte. */
  ala: number;
}

/**
 * A diner's lines against the meal credit: anything past one credit's
 * worth either uses another credit or is charged à la carte (the server
 * chooses per line, starting from the HO Settings default); sides past the
 * allowance are always à la carte when HO Settings says so.
 */
export function creditUse(diner: Diner, overflowChoice: Record<string, 'credit' | 'ala'>, cfg: DiningConfig = DEFAULT_CONFIG): CreditUse | null {
  const rules = mealCreditRules(cfg);
  const per = perCredit(rules);
  const counted = diner.items.filter((i) => !i.comped && creditKind(i.itemId));
  if (!counted.length) return null;
  const used: Record<CreditKind, number> = { app: 0, entree: 0, side: 0, dessert: 0 };
  const overflow: OrderLine[] = [];
  for (const line of counted) {
    const k = creditKind(line.itemId)!;
    if (used[k] < per[k]) used[k] += 1;
    else overflow.push(line);
  }
  const extraCredits = overflow.filter((l) => !overflowIsAla(diner, l, overflowChoice, cfg)).length;
  return { diner, overflow, credits: 1 + extraCredits, ala: overflow.length - extraCredits };
}

/** A line beyond the credit that is charged à la carte. */
export function overflowIsAla(
  diner: Diner,
  line: OrderLine,
  overflowChoice: Record<string, 'credit' | 'ala'>,
  cfg: DiningConfig = DEFAULT_CONFIG,
): boolean {
  const rules = mealCreditRules(cfg);
  return isExtraSide(diner, line, rules) || (overflowChoice[line.id] ?? rules.overflow) === 'ala';
}

export function defaultPlanMode(d: Diner): PlanMode {
  if (d.kind === 'associate') return 'alacarte';
  const plan = residentPlan((dinerPerson(d) as Resident | undefined)?.id);
  return !plan || plan.type === 'A la carte' ? 'alacarte' : 'count';
}

export function defaultDrop(d: Diner, o: Order): DropType {
  if (d.kind === 'associate') return 'assoc';
  return o.queueType === 'delivery' ? 'delivery' : o.queueType === 'pickup' ? 'pickup' : 'dinein';
}

export interface CloseCharge extends DinerBilling {
  /** A guest's meal on the host's meal credit. */
  hostCredit: boolean;
}

export interface CloseInputs {
  order: Order;
  mode: Record<string, PlanMode>;
  drop: Record<string, DropType>;
  overflowChoice: Record<string, 'credit' | 'ala'>;
  /** Guests put on their host's meal credit. */
  guestOnHost: Record<string, boolean>;
  /** Residents here can use meal credits for guests. */
  guestCreditOn: boolean;
  /** The delivery or pick up fee is comped. */
  feeComped: boolean;
  cfg?: DiningConfig;
}

/** What a diner is charged at close, after comps, à la carte and extra credits. */
export function closeCharge(d: Diner, x: CloseInputs): CloseCharge {
  const cfg = x.cfg ?? DEFAULT_CONFIG;
  const base = dinerBilling(d, { ...x.order, feeComped: x.feeComped || !!x.order.comp }, cfg);
  const mode = x.mode[d.id] ?? defaultPlanMode(d);
  const drop = x.drop[d.id] ?? defaultDrop(d, x.order);
  const comped = mode === 'comp' || !!NO_CHARGE_DROPS[drop] || !!x.order.comp || (isHospiceDiner(d, cfg) && !base.hospiceMeal);
  if (comped) return { ...base, outOfPlan: 0, needsDrop: false, covered: true, comped: true, hospiceMeal: false, hostCredit: false };
  // Hospice: the meal is comped, only the fees billing kept (e.g. the delivery fee with its hospice waiver off) charge.
  if (base.hospiceMeal) return { ...base, comped: false, hostCredit: false };
  if (mode === 'alacarte') {
    const amt = alaCarteTotal(d) + base.delivery;
    return { ...base, outOfPlan: amt, needsDrop: amt > 0, covered: false, comped: false, hostCredit: false };
  }
  const use = creditUse(d, x.overflowChoice, cfg);
  const extra = use
    ? use.overflow.filter((l) => overflowIsAla(d, l, x.overflowChoice, cfg)).reduce((s, l) => s + (lineItem(l)?.alaPrice ?? 0), 0)
    : 0;
  if (d.isGuest && x.guestOnHost[d.id] && x.guestCreditOn) {
    const amt = (base.delivery || 0) + extra;
    return { ...base, outOfPlan: amt, needsDrop: amt > 0, covered: true, comped: false, hostCredit: true };
  }
  if (extra > 0) return { ...base, outOfPlan: base.outOfPlan + extra, needsDrop: true, covered: false, hostCredit: false };
  return { ...base, hostCredit: false };
}

/** What a host's plan gives up at this close: their own meal and the guests on their credit. */
export interface PlanUse {
  left: number;
  own: number;
  guests: number;
  /** Guests' first names. */
  names: string[];
}

export function hostPlan(r: Resident | undefined): { left: number } | null {
  const plan = r && residentPlan(r.id);
  return plan && plan.amt && (plan.type === 'Monthly' || plan.type === 'Daily') ? { left: Math.max(0, plan.amt - r.consumed) } : null;
}

export interface CloseRow {
  diner: Diner;
  /** The resident behind the diner (the host, for a guest). */
  person: Resident | undefined;
  charge: CloseCharge;
}

/** __kPlanUse, keyed by the host's resident id. */
export function planUse(rows: CloseRow[], mode: Record<string, PlanMode>, uses: Array<CreditUse | null>): Record<string, PlanUse> {
  const by: Record<string, PlanUse> = {};
  for (const r of rows) {
    const h = hostPlan(r.person);
    if (!h || !r.person || r.charge.comped || r.charge.hospiceMeal) continue;
    const own = !r.diner.isGuest && r.diner.kind !== 'associate' && (mode[r.diner.id] ?? defaultPlanMode(r.diner)) !== 'alacarte' && h.left > 0;
    const guest = r.diner.isGuest && r.charge.hostCredit;
    if (!own && !guest) continue;
    const u = (by[r.person.id] ??= { left: h.left, own: 0, guests: 0, names: [] });
    const credits = uses.find((x) => x?.diner.id === r.diner.id)?.credits ?? 1;
    if (own) u.own += credits;
    else {
      u.guests += credits;
      u.names.push(dinerName(r.diner).split(' ')[0]);
    }
  }
  return by;
}

export type CloseTone = 'plan' | 'charge' | 'comp';

export interface CloseView {
  k: 'comp' | 'charge' | 'plan' | 'none';
  tone: CloseTone;
  amt: number;
  how: PayHow | null;
  /** The meal plan covers the meal. */
  onPlan: boolean;
  title: string;
  sub: string;
}

const first = (s: string | undefined) => String(s ?? '').split(' ')[0];
const meals = (k: number) => `${k} ${k === 1 ? 'meal' : 'meals'}`;

/** __kCloseView: the band for one person. */
export function closeView(
  row: CloseRow,
  o: Order,
  opts: { mode: PlanMode; noCharge: string | null; how: PayHow; tablePay: TablePay; credits?: number; why?: string; pu?: PlanUse },
): CloseView {
  const d = row.diner;
  const c = row.charge;
  const pe = row.person;
  const name = first(dinerName(d));
  const host = pe?.name ? first(pe.name) : name;
  const g = c.hostCredit && d.isGuest;
  const plan = (g || (!d.isGuest && d.kind !== 'associate')) && pe ? residentPlan(pe.id) : undefined;
  const counts = !!plan && (plan.type === 'Monthly' || plan.type === 'Daily');
  const left = counts && pe ? Math.max(0, plan!.amt - (pe.consumed || 0)) : 0;
  const use = opts.credits || 1;
  const extra = opts.pu && !d.isGuest ? opts.pu.guests : 0;
  const after = opts.pu && (g || extra) ? Math.max(0, left - opts.pu.own - opts.pu.guests) : Math.max(0, left - use);
  const tail = g || extra ? ' left after this table' : ' left after this one';
  const onPlan = counts && left > 0 && opts.mode !== 'alacarte' && opts.mode !== 'comp' && !o.comp;

  if (c.comped) {
    if (opts.mode === 'comp' || o.comp)
      return {
        k: 'comp',
        tone: 'comp',
        amt: 0,
        how: null,
        onPlan: false,
        title: 'Comped by the house, no charge',
        sub: (opts.why || 'Manager choice') + ' · manager approved' + (o.comp ? ' at ring-in' : ''),
      };
    return { k: 'comp', tone: 'comp', amt: 0, how: null, onPlan: false, title: 'No charge', sub: opts.noCharge ?? '' };
  }
  if (c.outOfPlan > 0) {
    const card = opts.tablePay !== 'each' || opts.how === 'card';
    const dest = card
      ? opts.tablePay === 'one'
        ? "the table's card"
        : opts.tablePay === 'split'
          ? "the table's two cards"
          : 'a card at the terminal'
      : d.kind === 'associate'
        ? `${name}'s associate account`
        : `${d.isGuest ? host : name}'s resident account`;
    return {
      k: 'charge',
      tone: 'charge',
      amt: c.outOfPlan,
      how: card ? 'card' : 'apt',
      onPlan,
      title: 'Charged to ' + dest,
      sub: c.hospiceMeal
        ? 'Hospice · the meal is comped, the delivery fee still charges'
        : onPlan
          ? `${g ? `${host}'s meal plan` : 'Meal plan'} covers the meal · ${meals(after)}${tail} · extras are charged`
          : opts.mode === 'alacarte'
            ? 'Everything à la carte, so no meal is used'
            : d.isGuest
              ? 'Guest pays à la carte'
              : d.kind === 'associate'
                ? 'Associate pays à la carte'
                : counts
                  ? 'Meal plan used up this cycle, so the meal is charged'
                  : 'No meal plan, pays à la carte',
    };
  }
  if (onPlan) {
    const guests = opts.pu?.names ?? [];
    const guestText = extra
      ? ` plus ${meals(extra)} for ${guests.slice(0, -1).join(', ')}${guests.length > 1 ? ' and ' : ''}${guests[guests.length - 1]}`
      : '';
    return {
      k: 'plan',
      tone: 'plan',
      amt: 0,
      how: null,
      onPlan,
      title: g ? `Covered by ${host}'s meal plan` : 'Covered by meal plan',
      sub: g ? `Uses ${use} of ${host}'s meals · ${meals(after)}${tail}` : `This meal uses ${meals(use)}${guestText} · ${meals(after)}${tail}`,
    };
  }
  return { k: 'none', tone: 'comp', amt: 0, how: null, onPlan: false, title: 'Nothing to charge', sub: '' };
}

/** __kCloseCta: "Charge $29.00 & close", "Close 1 of 2 · nothing to charge". */
export function closeButtonLabel(views: CloseView[], total: number, closing: number, all: number): string {
  const part = closing < all ? ` ${closing} of ${all}` : '';
  if (total <= 0) return `Close${part} · nothing to charge`;
  return views.some((v) => v.how === 'apt') ? `Charge ${formatMoney(total)} & close${part}` : `Close${part} · ${formatMoney(total)} paid by card`;
}

/** "$29.00 to resident accounts · 1 person on the meal plan" under the table total. */
export function totalBreakdown(views: CloseView[]): string {
  const sum = (h: PayHow) => views.filter((v) => v.how === h).reduce((a, v) => a + v.amt, 0);
  const apt = sum('apt');
  const card = sum('card');
  const plan = views.filter((v) => v.k === 'plan').length;
  return [
    apt > 0 && `${formatMoney(apt)} to resident accounts`,
    card > 0 && `${formatMoney(card)} on card`,
    plan > 0 && `${plan} ${plan === 1 ? 'person' : 'people'} on the meal plan`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Frank's resident account", "Associate account", or the card option's label. */
export function payLabel(how: PayHow, d: Diner, person: Resident | undefined): string {
  if (how === 'card') return 'Credit Card · Square terminal';
  if (d.kind === 'associate') return 'Associate account';
  return `${d.isGuest && person?.name ? first(person.name) : first(dinerName(d))}'s resident account`;
}

/**
 * The payment recorded per diner when the check closes:
 *   comp:<reason>:<amount>, apt:<amount>, card:<amount>:<ref>, plan, plan:host:<rid>
 */
export function chargeDrop(row: CloseRow, how: PayHow, compReason: string, cardRef: () => string): string {
  const c = row.charge;
  if (c.comped) return `comp:${compReason}:${alaCarteTotal(row.diner) || 0}`;
  if (c.outOfPlan > 0) return `${how}:${c.outOfPlan}` + (how === 'card' ? `:${cardRef()}` : '');
  return c.hostCredit ? `plan:host:${row.person?.id ?? ''}` : 'plan';
}

/** Price of a line on the close screen (a guest on the host's credit pays resident prices). */
export function closeLinePrice(line: OrderLine, d: Diner, charge: CloseCharge, ala: boolean): number {
  return linePrice(line, charge.hostCredit ? { ...d, isGuest: false } : d, ala ? 'ala' : undefined);
}

/**
 * What each card pays: the whole total on one card, or split by percent
 * across two. The second card takes whatever the first leaves, so the two
 * always add up to the total to the cent.
 */
export function splitAmounts(total: number, mode: TablePay, pct: number): number[] {
  if (mode !== 'split') return [total];
  const first = Math.round(total * pct) / 100;
  return [first, Math.round((total - first) * 100) / 100];
}
