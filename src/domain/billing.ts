/**
 * Prices, fees and how each diner's meal is paid for.
 */
import { getItem, mealPlans, venueFees } from '../data';
import { DEFAULT_CONFIG, type DiningConfig } from './config';
import { upcharge } from './menu';
import { dinerPerson } from './orders';
import type { Diner, Order, OrderLine, Resident } from './types';
import { hospiceOnOrder, isHospiceDiner } from './waivers';

/**
 * ad: one line's price for a diner. Residents (not their guests) pay the
 * resident price; guests and associates the guest price; "ala" forces the
 * à la carte price. Modifier upcharges are added on top.
 */
export function linePrice(line: OrderLine, diner: Pick<Diner, 'kind' | 'isGuest'>, mode?: 'ala'): number {
  const it = getItem(line.itemId);
  if (!it) return 0;
  const base =
    mode === 'ala'
      ? (it.alaPrice ?? it.guestPrice)
      : diner.kind === 'resident' && !diner.isGuest
        ? it.residentPrice || 0
        : it.guestPrice;
  return base + upcharge(line);
}

/** Ec: a diner's lines at à la carte prices, comped lines excluded. */
export function alaCarteTotal(diner: Pick<Diner, 'items'>): number {
  return diner.items
    .filter((i) => !i.comped)
    .reduce((sum, i) => {
      const it = getItem(i.itemId);
      return sum + (it?.alaPrice ?? it?.guestPrice ?? 0) + upcharge(i);
    }, 0);
}

/** Sh: a diner's lines at their own prices (comped lines included, as in the original). */
export function dinerItemsTotal(diner: Diner): number {
  return diner.items.reduce((sum, i) => sum + linePrice(i, diner), 0);
}

export interface QueueFee {
  kind: 'Delivery fee' | 'Pick up fee' | null;
  amt: number;
  waived?: 'hospice' | 'sick';
}

/** __kSickFee: a sick-tray delivery has no fee. */
export const SICK_TRAY_FEE: QueueFee = { kind: 'Delivery fee', amt: 0, waived: 'sick' };

/** mh: the pick up or delivery fee for an order (waived for hospice and sick trays). */
export function queueFee(o: Order, cfg: DiningConfig = DEFAULT_CONFIG): QueueFee {
  const fees = venueFees[o.room] ?? venueFees.sequoia;
  if (o.queueType === 'delivery') {
    if (hospiceOnOrder(o, cfg)) return { kind: 'Delivery fee', amt: 0, waived: 'hospice' };
    if (o.sickTray) return { ...SICK_TRAY_FEE };
    return { kind: 'Delivery fee', amt: fees.delivery };
  }
  if (o.queueType === 'pickup') return { kind: 'Pick up fee', amt: fees.pickup };
  return { kind: null, amt: 0 };
}

/**
 * __kCork: corkage is a check-level charge set per venue, like the delivery
 * and pick up fees, never a menu item. On by default at $10 a bottle.
 */
export function corkageSettings(room: string, cfg: DiningConfig = DEFAULT_CONFIG): { on: boolean; amt: number } {
  const c = cfg.corkage[room] ?? {};
  return { on: c.on !== false, amt: c.amt != null && c.amt >= 0 ? c.amt : 10 };
}

/** __kCorkAmt: bottles × the venue's corkage fee (lands on seat 1). */
export function corkageAmount(o: Order | null | undefined, cfg: DiningConfig = DEFAULT_CONFIG): number {
  if (!o || !(o.corkage && o.corkage > 0)) return 0;
  const c = corkageSettings(o.room, cfg);
  return c.on ? o.corkage * c.amt : 0;
}

export interface DinerBilling {
  planLabel: string;
  planType: string;
  /** One line for the close screen. */
  remainText: string;
  itemsTotal: number;
  /** Check-level fees on seat 1: delivery / pick up and corkage. */
  delivery: number;
  /** What has to be charged outside the meal plan. */
  outOfPlan: number;
  /** A payment method must be chosen. */
  needsDrop: boolean;
  /** The meal plan covers this meal. */
  covered: boolean;
  comped?: boolean;
}

/**
 * dd: how a diner's meal is paid for. Hospice residents are comped;
 * associates and guests pay à la carte; residents on a monthly or daily plan
 * are covered while the cycle has meals left (fees and items still charge).
 */
export function dinerBilling(diner: Diner, o: Order, cfg: DiningConfig = DEFAULT_CONFIG): DinerBilling {
  const itemsTotal = dinerItemsTotal(diner);
  const fees =
    (diner.seat === 1 && !o.feeComped ? queueFee(o, cfg).amt : 0) + (diner.seat === 1 && !o.comp ? corkageAmount(o, cfg) : 0);
  const total = itemsTotal + fees;
  const base = { itemsTotal, delivery: fees };
  if (isHospiceDiner(diner, cfg)) {
    return {
      planLabel: 'Hospice',
      planType: 'Comp',
      remainText: 'Hospice · comped automatically, no meal credit used',
      ...base,
      outOfPlan: 0,
      needsDrop: false,
      covered: true,
      comped: true,
    };
  }
  const payAlaCarte = (planLabel: string, remainText: string): DinerBilling => ({
    planLabel,
    planType: 'A la carte',
    remainText,
    ...base,
    outOfPlan: total,
    needsDrop: total > 0,
    covered: false,
  });
  if (diner.kind === 'associate') return payAlaCarte('Associate', 'Pays à la carte');
  const resident = dinerPerson(diner) as Resident | undefined;
  const plan = (resident && mealPlans[resident.plan]) || mealPlans.alacarte;
  if (diner.isGuest) return payAlaCarte('Guest', 'Guest pays à la carte');
  if (plan.type === 'A la carte') return payAlaCarte(plan.label, 'No plan — à la carte');
  if ((plan.type === 'Monthly' || plan.type === 'Daily') && resident) {
    const left = Math.max(0, plan.amt - resident.consumed);
    const covered = left > 0;
    return {
      planLabel: plan.label,
      planType: plan.type,
      remainText: covered
        ? `${left} of ${plan.amt} ${plan.unit} left · this meal uses 1 → ${left - 1} left after`
        : 'Cycle used up — extras charged',
      ...base,
      outOfPlan: total,
      needsDrop: total > 0,
      covered,
    };
  }
  return payAlaCarte('À la carte', '');
}
