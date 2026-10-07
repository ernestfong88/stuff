import { RotateCcw, Gift } from 'lucide-react';
import { deliveryFees, getItem } from '../../../../data';
import { dinerName } from '../../../../domain/orders';
import { modsText } from '../../../../domain/menu';
import type { Order } from '../../../../domain/types';
import { now } from '../../../../lib/clock';
import { formatTime } from '../../../../lib/format';
import { useConfig } from '../../../../store/config';
import { useDining } from '../../../../store/dining';
import { Button, toast, useConfirm } from '../../../../ui';
import { BoCaption, BoSelect } from '../../kit';
import { BACK_OFFICE_USER } from '../../seed/associates';
import { PAYMENT_CHOICES, PAYMENT_LABELS, dinerCharge, feedbackTag, type OrderRow } from './orderRows';
import s from './orders.module.css';

const BY = 'Back Office';

/** Append a correction to the check's activity trail. */
function corrected(o: Order, what: string): Order {
  return { ...o, log: [...(o.log ?? []), { at: now(), k: 'fix', by: BY, what }] };
}

/** One check opened up: who ate what, how each diner paid, and corrections for closed checks. */
export function OrderDetail({ row }: { row: OrderRow }) {
  const { setHistory, reopenOrder } = useDining();
  const cfg = useConfig();
  const [ask, dialog] = useConfirm();
  const o = row.order;
  const fee = o.deliveryFeeId ? deliveryFees.find((f) => f.id === o.deliveryFeeId) : undefined;
  const fix = (patch: (o: Order) => Order, what: string, message: string) => {
    setHistory((list) => list.map((x) => (x.id === o.id ? corrected(patch(x), what) : x)));
    toast(message, { tone: 'success' });
  };

  return (
    <div className={s.detail}>
      <div className={s.diners}>
        {o.diners.map((d) => {
          const fb = feedbackTag(d.feedback);
          const charge = dinerCharge(d, o, cfg);
          return (
            <section key={d.id} className={s.diner} aria-label={dinerName(d)}>
              <div className={s.dinerHead}>
                <span className={s.dinerName}>
                  {dinerName(d)}
                  {d.isGuest && <span className={s.guest}> · guest</span>}
                </span>
                <span className={s.seat}>Seat {d.seat}</span>
              </div>
              <ul className={s.lines}>
                {d.items.length === 0 && <li className={s.lineMuted}>Nothing ordered</li>}
                {d.items.map((l) => {
                  const mods = modsText(l.mods);
                  return (
                    <li key={l.id} className={l.cancelled ? s.lineMuted : undefined}>
                      <span className={s.item}>{getItem(l.itemId)?.name ?? 'Item'}</span>
                      {mods && <span className={s.mods}> · {mods}</span>}
                      {l.cancelled && <span className={s.flag}> · cancelled</span>}
                      {l.comped && <span className={s.flag}> · comped</span>}
                      {l.note && <div className={s.note}>“{l.note}”</div>}
                    </li>
                  );
                })}
              </ul>
              {fb && <div className={s.fb}>Feedback: {fb.text}</div>}
              {!row.open && (
                <div className={s.pay}>
                  <label className={s.payLabel} htmlFor={`pay-${d.id}`}>
                    Paid with
                  </label>
                  <BoSelect
                    id={`pay-${d.id}`}
                    value={d.chargeDrop ?? 'plan'}
                    onChange={(e) => {
                      const v = e.target.value;
                      fix(
                        (x) => ({ ...x, diners: x.diners.map((y) => (y.id === d.id ? { ...y, chargeDrop: v, chargeAmt: undefined } : y)) }),
                        `Changed ${dinerName(d)}'s payment to ${PAYMENT_LABELS[v]}`,
                        `${dinerName(d)} now paid with ${PAYMENT_LABELS[v].toLowerCase()}`,
                      );
                    }}
                  >
                    {PAYMENT_CHOICES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </BoSelect>
                  {charge > 0 && <span className={s.payAmt}>${charge.toFixed(2)}</span>}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className={s.side}>
        <div className={s.facts}>
          <div>
            Opened {formatTime(o.openedAt)}
            {o.closedAt ? ` · Closed ${formatTime(o.closedAt)} by ${o.closedBy ?? o.server}` : ''}
          </div>
          {fee && (
            <div>
              Delivery: <strong>{fee.text}</strong>
              {fee.amt > 0 && ` · $${fee.amt}`}
            </div>
          )}
          {o.comp && (
            <div>
              Comped: <strong>{o.comp.reason}</strong>
            </div>
          )}
          {row.open && <div className={s.openNote}>Still open on the floor. Corrections are made once it is closed.</div>}
        </div>

        {!row.open && (
          <div className={s.fixes}>
            <BoCaption>Corrections</BoCaption>
            <div className={s.fixButtons}>
              <Button
                size="sm"
                icon={<Gift size={14} />}
                onClick={() =>
                  o.comp
                    ? fix((x) => ({ ...x, comp: null }), 'Removed the comp', 'Comp removed')
                    : fix((x) => ({ ...x, comp: { reason: `Back office correction (${BACK_OFFICE_USER.short})`, at: now() } }), 'Comped the check', 'Check comped')
                }
              >
                {o.comp ? 'Remove comp' : 'Comp the check'}
              </Button>
              <Button
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={async () => {
                  const ok = await ask({
                    title: 'Reopen this check?',
                    message: 'It goes back on the floor, open, so the server can change it and close it again.',
                    confirmLabel: 'Reopen',
                  });
                  if (ok) {
                    reopenOrder(o.id);
                    toast('Check reopened on the floor', { tone: 'success' });
                  }
                }}
              >
                Reopen check
              </Button>
            </div>
          </div>
        )}

        {(o.log?.length ?? 0) > 0 && (
          <div className={s.log}>
            <BoCaption>Latest activity</BoCaption>
            <ol className={s.logList}>
              {[...(o.log ?? [])]
                .slice(-5)
                .reverse()
                .map((e, i) => (
                  <li key={i}>
                    <span className={s.logTime}>{formatTime(e.at)}</span> {e.what} <span className={s.logBy}>· {e.by}</span>
                  </li>
                ))}
            </ol>
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}
