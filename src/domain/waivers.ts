/**
 * Delivery fee waivers: hospice and sick trays.
 *
 * Hospice: Back Office (or a manager with their PIN, from a delivery) sets
 * it on the resident profile. While a resident is on hospice every delivery
 * of theirs has the fee waived with no PIN, it never counts as a sick
 * waiver, and their meals are comped automatically. Staff can switch it off
 * for one order (order.hospiceOff).
 *
 * Sick trays (a draft rule to confirm with the project team): when a
 * resident is sick the delivery fee can be waived with no manager PIN, up to
 * so many times a calendar month: 3 by default, set per community. Past the
 * limit the fee is charged unless a manager comps it. The waiver lives on
 * the order and its count is fixed when it is granted.
 */
import { COMMUNITY_NAME } from '../data';
import { DAY, HOUR, now, today } from '../lib/clock';
import { isoOf } from '../lib/dates';
import { DEFAULT_CONFIG, flag, type DiningConfig, type HospiceStatus } from './config';
import type { Diner, Order } from './types';

// ─── Hospice ─────────────────────────────────────────────────────────────

/** Residents on hospice at the start of the demo. */
export function seedHospice(base: number = now()): Record<string, HospiceStatus> {
  const a = base - 13 * DAY;
  const b = base - 4 * DAY;
  const entry = (at: number, note = ''): HospiceStatus => ({
    on: true,
    since: isoOf(at),
    note,
    by: 'Ernest Fong',
    at,
    log: [{ on: true, by: 'Ernest Fong', at }],
  });
  return {
    r7: entry(a, 'Comfort care. Family visits most afternoons.'),
    r10: entry(b),
    r2: entry(a),
  };
}

const HOSPICE_SEED = seedHospice();

/** __kHosp: the resident's hospice status (Back Office first, then the seed). */
export function hospiceStatus(rid: string | null | undefined, cfg: DiningConfig = DEFAULT_CONFIG): HospiceStatus | null {
  if (!rid) return null;
  return cfg.hospice[rid] ?? HOSPICE_SEED[rid] ?? null;
}

/** __kHospIs */
export function isOnHospice(rid: string | null | undefined, cfg: DiningConfig = DEFAULT_CONFIG): boolean {
  return !!hospiceStatus(rid, cfg)?.on;
}

/** __kHospAuto: on hospice and the free-delivery comp is switched on. */
export function hospiceWaivesFee(rid: string | null | undefined, cfg: DiningConfig = DEFAULT_CONFIG): boolean {
  return isOnHospice(rid, cfg) && flag(cfg, 'freeDeliveryComp');
}

/** __kHospOn: this delivery's fee is waived for hospice. */
export function hospiceOnOrder(o: Order | null | undefined, cfg: DiningConfig = DEFAULT_CONFIG): boolean {
  return !!(o && o.queueType === 'delivery' && !o.hospiceOff && hospiceWaivesFee(orderResidentId(o), cfg));
}

/** __kHospDiner: a resident (not a guest) on hospice, whose meal is comped automatically. */
export function isHospiceDiner(d: Diner | null | undefined, cfg: DiningConfig = DEFAULT_CONFIG): boolean {
  if (!d || d.kind !== 'resident' || d.isGuest || !flag(cfg, 'hospiceAuto')) return false;
  return isOnHospice(d.refId, cfg);
}

/** __kFreeComp: comp reasons that apply with no PIN. */
export function automaticComp(o: Order | null | undefined, cfg: DiningConfig = DEFAULT_CONFIG): string[] | null {
  return o && o.queueType === 'delivery' && hospiceWaivesFee(orderResidentId(o), cfg) ? ['Hospice'] : null;
}

/**
 * __kHospSet: the status after a change. Switching it on stamps the start
 * date; every switch is logged (latest 12 kept).
 */
export function nextHospiceStatus(
  current: HospiceStatus | null,
  patch: Partial<HospiceStatus>,
  by: string,
  at: number = now(),
): HospiceStatus {
  const h: HospiceStatus = current ?? { on: false, since: '', note: '', log: [] };
  const changed = patch.on != null && patch.on !== h.on;
  const next: HospiceStatus = { ...h, ...patch };
  if (changed && patch.on && !next.since) next.since = isoOf(at);
  if (changed) {
    next.by = by;
    next.at = at;
    next.log = [{ on: !!patch.on, by, at }, ...(h.log ?? [])].slice(0, 12);
  }
  return next;
}

// ─── Sick trays ──────────────────────────────────────────────────────────

/** __kSickRid: the resident a delivery is for (first non-guest resident). */
export function orderResidentId(o: Order): string | undefined {
  return (o.diners ?? []).find((x) => x.kind === 'resident' && !x.isGuest)?.refId;
}

/** __kSickCfg: whether waivers are on and how many a month are allowed. */
export function sickConfig(
  community: string = COMMUNITY_NAME,
  cfg: DiningConfig = DEFAULT_CONFIG,
): { on: boolean; allow: number } {
  const s = cfg.sick[community] ?? {};
  return { on: s.on !== false, allow: s.allow != null && s.allow >= 0 ? Math.floor(s.allow) : 3 };
}

/** __kMonth0: start of the current month (the waiver period). */
export function monthStart(): number {
  const d = today();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** __kSickTill: last day of the period, "10/31". */
export function sickPeriodEnd(): string {
  const d = today();
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${e.getMonth() + 1}/${e.getDate()}`;
}

/** A past sick-tray waiver that is no longer on the board. */
export type SickWaiverRecord = Pick<Order, 'id' | 'queueType' | 'sickTray'> & { ref: string; at: number; meal: string; openedAt?: number };

/** __K_SICK_SEED: waivers granted earlier this month. */
export function seedSickWaivers(): SickWaiverRecord[] {
  const m = monthStart();
  const day = today().getDate();
  const at = (x: number) => m + (Math.max(1, Math.min(day, x)) - 1) * DAY + 9 * HOUR;
  const rows: Array<[string, number, string, string]> = [
    ['r9', 3, 'Adriana', 'Dinner'],
    ['r9', 9, 'Ricardo', 'Lunch'],
    ['r9', 17, 'Adriana', 'Dinner'],
    ['r8', 12, 'Maria', 'Lunch'],
    ['r4', 21, 'Ricardo', 'Dinner'],
    ['r13', 6, 'Adriana', 'Lunch'],
    ['r13', 19, 'Resident at the kiosk', 'Dinner'],
  ];
  return rows.map(([rid, x, by, meal], i) => {
    const t = Math.max(m, Math.min(at(x), now() - (7 - i) * 2_700_000));
    return { id: 'sk' + i, ref: '#D' + (1041 + i), at: t, meal, queueType: 'delivery', sickTray: { rid, n: 0, by, at: t } };
  });
}

const SICK_SEED = seedSickWaivers();

/**
 * __kSickAll: sick-tray waivers this month across the seed and the given
 * orders (pass open orders and history). Hospice deliveries never count.
 */
export function sickWaiversThisMonth(
  orders: Order[],
  cfg: DiningConfig = DEFAULT_CONFIG,
): Array<SickWaiverRecord | Order> {
  const m = monthStart();
  const byId = new Map<string, SickWaiverRecord | Order>();
  for (const o of [...SICK_SEED, ...orders]) {
    if (!o?.sickTray) continue;
    if ('diners' in o && hospiceOnOrder(o as Order, cfg)) continue;
    if ((o.sickTray.at || ('at' in o ? (o.at as number) : 0) || o.openedAt || 0) >= m) byId.set(o.id, o);
  }
  return [...byId.values()];
}

/** __kSickUsed: waivers a resident has used this month, not counting order `skipId`. */
export function sickWaiversUsed(
  rid: string,
  orders: Order[],
  skipId?: string,
  cfg: DiningConfig = DEFAULT_CONFIG,
): number {
  return sickWaiversThisMonth(orders, cfg).filter((o) => o.sickTray!.rid === rid && o.id !== skipId).length;
}
