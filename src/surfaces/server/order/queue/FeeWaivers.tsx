import { useState } from 'react';
import { Check } from 'lucide-react';
import { COMMUNITY_NAME, getResident, venueFees } from '../../../../data';
import { logAuthor } from '../../../../domain/activityLog';
import type { Order } from '../../../../domain/types';
import {
  hospiceOnOrder,
  hospiceStatus,
  hospiceWaivesFee,
  isOnHospice,
  orderResidentId,
  sickConfig,
  sickPeriodEnd,
  sickWaiversUsed,
} from '../../../../domain/waivers';
import { now } from '../../../../lib/clock';
import { formatMoney } from '../../../../lib/format';
import { setHospice, useConfig } from '../../../../store/config';
import { useDining } from '../../../../store/dining';
import { useSession } from '../../../../store/session';
import { cx } from '../../../../ui';
import { ManagerPinDialog } from '../../shared/ManagerPin';
import s from './FeeWaivers.module.css';

const deliveryFee = (o: Order) => (venueFees[o.room] ?? venueFees.sequoia).delivery;

/** "2026-10-03" → "Oct 3, 2026" */
function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isoToday(): string {
  const d = new Date(now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Hospice on a resident's delivery. While a resident is on hospice the fee
 * is waived with no PIN and it never uses a sick waiver; staff can switch
 * it off for one order. A resident not on hospice can be marked with a
 * manager PIN, which updates their profile.
 */
export function HospiceWaiver({ order: o }: { order: Order }) {
  const cfg = useConfig();
  const { patchOrder } = useDining();
  const { mode } = useSession();
  const [ask, setAsk] = useState(false);
  const rid = o.queueType === 'delivery' ? orderResidentId(o) : undefined;
  if (!rid) return null;
  const first = getResident(rid)?.name.split(' ')[0] ?? 'the resident';
  const h = hospiceStatus(rid, cfg);
  const fee = deliveryFee(o);
  const me = o.source === 'kiosk' ? 'the delivery desk' : logAuthor(mode, o);

  if (hospiceWaivesFee(rid, cfg)) {
    const on = !o.hospiceOff;
    return (
      <div className={cx(s.box, on && s.hospiceOn)}>
        <button
          role="switch"
          aria-checked={on}
          className={s.switch}
          onClick={() => patchOrder(o.id, { hospiceOff: on ? { by: me, at: now() } : null })}
        >
          <span className={cx(s.tick, on && s.tickHospice)} aria-hidden>
            {on && <Check size={15} strokeWidth={3} />}
          </span>
          <span className={s.what}>Hospice · delivery fee waived</span>
          <span className={cx(s.fee, on && s.struck)}>{formatMoney(fee)}</span>
        </button>
        <p className={s.note}>
          {on
            ? `${first} is on hospice in their profile${h?.since ? ' since ' + longDate(h.since) : ''}. No manager PIN needed, and it doesn't use a sick waiver.` +
              (h?.note ? ' Note: ' + h.note : '')
            : `Switched off for this order by ${o.hospiceOff?.by ?? 'staff'}, so the ${formatMoney(fee)} fee applies. ${first} is still on hospice in their profile.`}
        </p>
      </div>
    );
  }
  if (isOnHospice(rid, cfg)) return null;
  return (
    <div className={s.offer}>
      <span className={s.offerText}>Hospice? {first} isn't on hospice in their profile.</span>
      <button className={s.offerBtn} onClick={() => setAsk(true)}>
        Mark {first} as on hospice…
      </button>
      {ask && (
        <ManagerPinDialog
          title={`Mark ${first} as on hospice`}
          sub={`Manager PIN. This updates ${first}'s resident profile, so this delivery and every one after it has no delivery fee, with no PIN. Turn it off in Back Office, Residents.`}
          onClose={() => setAsk(false)}
          onOk={() => {
            setAsk(false);
            setHospice(rid, { on: true, since: isoToday() }, 'Manager PIN, ' + me);
            patchOrder(o.id, { hospiceOff: null, sickTray: null });
          }}
        />
      )}
    </div>
  );
}

/**
 * Sick delivery fee waivers: when a resident is sick the delivery fee can
 * be waived with no manager PIN, up to so many times a month (3 by
 * default, set per community). Past the limit a manager PIN waives it, or
 * on the close screen a manager can comp the fee instead.
 */
export function SickWaiver({
  order: o,
  onComp,
  comp,
  onUndo,
}: {
  order: Order;
  /** Close screen: offer a manager comp once the waivers are used. */
  onComp?: () => void;
  comp?: { reason: string } | null;
  onUndo?: () => void;
}) {
  const cfg = useConfig();
  const { orders, history, patchOrder } = useDining();
  const { mode } = useSession();
  const [ask, setAsk] = useState(false);
  const c = sickConfig(COMMUNITY_NAME, cfg);
  const tray = o.sickTray;
  if (o.queueType !== 'delivery' || (!c.on && !tray) || hospiceOnOrder(o, cfg)) return null;
  const rid = orderResidentId(o);
  const used = rid ? sickWaiversUsed(rid, [...history, ...orders], o.id, cfg) : 0;
  const shown = used + (tray ? 1 : 0);
  const full = !tray && used >= c.allow;
  const disabled = !tray && !rid;
  const fee = deliveryFee(o);
  const till = sickPeriodEnd();
  const who = logAuthor(mode, o);
  const grant = (mgr: boolean) => rid && patchOrder(o.id, { sickTray: { rid, n: used + 1, by: who, at: now(), ...(mgr ? { mgr: true } : {}) } });
  const set = (on: boolean) => {
    if (on === !!tray || (on && disabled)) return;
    if (on && full) return setAsk(true);
    if (on) grant(false);
    else patchOrder(o.id, { sickTray: null });
  };
  const allUsed =
    c.allow === 0 ? 'No waivers are allowed' : c.allow === 1 ? `The one waiver is used until ${till}` : `All ${c.allow} are used until ${till}`;
  const msg = !rid
    ? 'Add the resident to the order to waive the fee.'
    : full && comp
      ? `The fee is comped instead: ${comp.reason} · manager approved.`
      : full
        ? `${allUsed}. Another waiver needs a manager PIN.`
        : tray
          ? `No delivery fee on this order. Waived by ${tray.by}` + (tray.mgr ? ` with a manager PIN, past the ${c.allow} included.` : '.')
          : 'No manager PIN needed.';
  return (
    <div className={s.box}>
      {ask && (
        <ManagerPinDialog
          title="Manager PIN"
          sub={`${allUsed}. Enter a manager PIN to waive the ${formatMoney(fee)} fee on this one.`}
          onClose={() => setAsk(false)}
          onOk={() => {
            grant(true);
            setAsk(false);
          }}
        />
      )}
      <button role="switch" aria-checked={!!tray} disabled={disabled} className={s.switch} onClick={() => set(!tray)}>
        <span className={cx(s.tick, tray && s.tickOn, disabled && s.tickOff)} aria-hidden>
          {tray && <Check size={15} strokeWidth={3} />}
        </span>
        <span className={cx(s.what, disabled && s.dim)}>Sick, waive delivery fee</span>
        <span className={cx(s.fee, (tray || comp) && s.struck, (tray || disabled) && s.dim)}>{formatMoney(fee)}</span>
      </button>
      {rid && (
        <div className={cx(s.count, full ? s.countFull : tray && s.countOn)}>
          Sick fee waivers: {shown > c.allow ? `${shown} used, the limit is ${c.allow}` : `${shown} of ${c.allow} used`} until {till}
        </div>
      )}
      <p className={cx(s.note, full && comp && s.noteComp)}>
        {msg}
        {full && comp && onUndo && (
          <button className={s.undo} onClick={onUndo}>
            Undo
          </button>
        )}
      </p>
      {full && onComp && !comp && (
        <button className={cx(s.offerBtn, s.compBtn)} onClick={onComp}>
          Manager comp…
        </button>
      )}
    </div>
  );
}
