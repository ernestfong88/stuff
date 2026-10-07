import { Check, CreditCard, Home, Printer } from 'lucide-react';
import { getItem } from '../../../../data';
import { corkageAmount, queueFee } from '../../../../domain/billing';
import { dinerName } from '../../../../domain/orders';
import type { Order } from '../../../../domain/types';
import { hospiceOnOrder, isHospiceDiner } from '../../../../domain/waivers';
import { formatMoney } from '../../../../lib/format';
import { useConfig } from '../../../../store/config';
import { Avatar, cx } from '../../../../ui';
import { alaCartePrice, isExtraSide } from '../checkLines';
import { dinerFace } from '../diners/DinerCard';
import { HospiceWaiver, SickWaiver } from '../queue/FeeWaivers';
import s from './CloseDinerCard.module.css';
import { CloseBand } from './CloseParts';
import {
  closeLinePrice,
  overflowIsAla,
  payLabel,
  type CloseRow,
  type CloseView,
  type CreditUse,
  type PayHow,
  type PlanMode,
  type PlanUse,
  type TablePay,
} from './closeMath';
import { GuestCredit } from './GuestCredit';
import { Terminal, type TerminalState } from './Payment';

export interface CloseDinerCardProps {
  order: Order;
  row: CloseRow;
  view: CloseView;
  use: CreditUse | null;
  mode: PlanMode;
  onMode: (m: PlanMode) => void;
  overflowChoice: Record<string, 'credit' | 'ala'>;
  onOverflow: (lineId: string, v: 'credit' | 'ala') => void;
  /** Why the manager comped this diner. */
  compReason?: string;
  onComp: () => void;
  guestOnHost: boolean;
  guestCreditOn: boolean;
  planUse: PlanUse | undefined;
  onGuestOnHost: (on: boolean) => void;
  how: PayHow;
  onHow: (h: PayHow) => void;
  tablePay: TablePay;
  terminal: TerminalState;
  onTerminal: (st: TerminalState) => void;
  printed: boolean;
  onPrint: () => void;
  /** The delivery or pick up fee comp on this close. */
  feeComp: { reason: string } | null;
  onFeeComp: () => void;
  onFeeUndo: () => void;
}

/** One person on the close screen: their band, how the meal is counted, the lines and how they pay. */
export function CloseDinerCard(p: CloseDinerCardProps) {
  const cfg = useConfig();
  const { order: o, row, view } = p;
  const d = row.diner;
  const c = row.charge;
  const hospice = isHospiceDiner(d, cfg);
  const autoHospice = hospice && p.mode !== 'comp' && !o.comp;
  const fee = queueFee(o, cfg);
  const cork = d.seat === 1 && !o.comp ? corkageAmount(o, cfg) : 0;
  const deliveryAmt = c.delivery - cork;
  const host = row.person?.name.split(' ')[0];

  return (
    <div className={cx(s.card, 'fade-in')}>
      <div className={s.head}>
        <Avatar person={dinerFace(d, row.person)} size={40} />
        <div className={s.who}>
          <div className={s.name}>
            {dinerName(d)}
            {d.isGuest ? (d.guestName ? ` — ${d.guestRel || 'guest'} of ${host}` : ' (guest)') : ''}
          </div>
          <div className={s.plan}>{c.planLabel}</div>
        </div>
        <button
          className={cx(s.print, p.printed && s.printed)}
          title={`Print a receipt for ${dinerName(d).split(' ')[0]}`}
          aria-label={`Print a receipt for ${dinerName(d).split(' ')[0]}`}
          onClick={p.onPrint}
        >
          {p.printed ? <Check size={15} aria-hidden /> : <Printer size={15} strokeWidth={1.75} aria-hidden />}
        </button>
      </div>

      <CloseBand view={view} />
      <GuestCredit
        diner={d}
        host={row.person}
        on={p.guestOnHost}
        comped={!!c.comped}
        enabled={p.guestCreditOn}
        use={p.planUse}
        onChange={p.onGuestOnHost}
      />

      <div className={s.counting}>
        {d.kind !== 'associate' &&
          (p.mode === 'comp' || o.comp || hospice ? (
            <div className={s.compRow}>
              <span className={s.compTag}>
                {autoHospice
                  ? 'Comped · Hospice · automatic, no meal credit used'
                  : `Comped · ${o.comp?.reason || p.compReason || 'Manager'} · manager approved${o.comp ? ' at ring-in' : ''}`}
              </span>
              {!autoHospice && !o.comp && (
                <button className={s.link} onClick={() => p.onMode('count')}>
                  undo
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className={s.eyebrow}>Meal plan · counted automatically</div>
              <div className={s.credits}>
                {p.mode === 'alacarte' ? (
                  <span className={s.ala}>Everything à la carte</span>
                ) : (
                  <span className={s.creditCount}>
                    {p.use ? p.use.credits : 1} credit{p.use && p.use.credits !== 1 ? 's' : ''}
                    {p.use && p.use.ala > 0 && <span className={s.ala}> + {p.use.ala} à la carte</span>}
                  </span>
                )}
                <span className={s.rule}>
                  1 starter + 1 entrée + 2 sides + 1 dessert per credit · a 3rd side and added proteins are à la carte · side swaps are free
                </span>
                <button className={s.link} onClick={() => p.onMode(p.mode === 'alacarte' ? 'count' : 'alacarte')}>
                  {p.mode === 'alacarte' ? 'use credits instead' : 'all à la carte instead'}
                </button>
              </div>
              {p.mode !== 'alacarte' &&
                p.use?.overflow.map((line) =>
                  isExtraSide(d, line) ? (
                    <div key={line.id} className={s.overflow}>
                      <span className={s.overflowText}>Third side, {getItem(line.itemId)?.name}:</span>
                      <span className={s.alaTag}>À la carte ${alaCartePrice(line)}</span>
                    </div>
                  ) : (
                    <div key={line.id} className={s.overflow}>
                      <span className={s.overflowText}>Beyond the credit — {getItem(line.itemId)?.name}:</span>
                      {(
                        [
                          ['credit', 'Another credit'],
                          ['ala', 'À la carte'],
                        ] as const
                      ).map(([v, label]) => (
                        <button
                          key={v}
                          className={cx(s.choice, (p.overflowChoice[line.id] ?? 'credit') === v && s.choiceOn)}
                          aria-pressed={(p.overflowChoice[line.id] ?? 'credit') === v}
                          onClick={() => p.onOverflow(line.id, v)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ),
                )}
            </div>
          ))}
        {d.kind !== 'associate' && p.mode !== 'comp' && (
          <button className={s.compBtn} onClick={p.onComp}>
            Comp…
          </button>
        )}
      </div>

      <div className={s.lines}>
        {d.items.map((line) => {
          const ala =
            p.mode === 'alacarte' || (!!p.use?.overflow.some((x) => x.id === line.id) && overflowIsAla(d, line, p.overflowChoice));
          const price = closeLinePrice(line, d, c, ala);
          return (
            <div key={line.id} className={s.line}>
              <span className={s.lineName}>{getItem(line.itemId)?.name}</span>
              <span className={cx(s.linePrice, !price && (view.onPlan ? s.onPlan : s.noCharge), !!price && c.comped && s.struck)}>
                {price ? formatMoney(price) : view.onPlan ? 'Meal plan' : 'No charge'}
              </span>
            </div>
          );
        })}
        {deliveryAmt > 0 && <FeeRow label="Delivery" amount={deliveryAmt} />}
        {d.seat === 1 && hospiceOnOrder(o, cfg) && <FeeRow label="Delivery fee waived (hospice)" amount={0} />}
        {d.seat === 1 && !hospiceOnOrder(o, cfg) && o.sickTray && <FeeRow label="Delivery fee waived (sick)" amount={0} />}
        {cork > 0 && <FeeRow label={`Corkage · ${o.corkage} ${o.corkage === 1 ? 'bottle' : 'bottles'}`} amount={cork} />}
        <div className={cx(s.sum, view.amt <= 0 && s[`sum_${view.tone}`])}>
          <span>{view.title}</span>
          <span className={s.sumAmt}>{formatMoney(view.amt)}</span>
        </div>
      </div>

      {d.seat === 1 && o.queueType === 'delivery' && !o.comp && !p.feeComp && <HospiceWaiver order={o} />}
      {d.seat === 1 && o.queueType === 'delivery' && !o.comp && (
        <SickWaiver order={o} onComp={p.onFeeComp} comp={p.feeComp} onUndo={p.onFeeUndo} />
      )}

      {c.needsDrop && (
        <div className={s.pay}>
          {d.seat === 1 && fee.kind && !o.sickTray && !hospiceOnOrder(o, cfg) && (
            <div className={s.fees}>
              <div className={s.eyebrow}>Fees</div>
              <div className={s.feeBox}>
                <span className={s.feeName}>
                  {fee.kind} <span className={s.feeSub}>· {o.queueType === 'delivery' ? 'delivery order' : 'pick up order'}</span>
                </span>
                {p.feeComp || o.comp ? (
                  <>
                    <span className={s.compTag}>Comped · {p.feeComp?.reason || o.comp?.reason} · manager approved</span>
                    {p.feeComp && (
                      <button className={s.link} onClick={p.onFeeUndo}>
                        undo
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className={s.feeAmt}>${fee.amt}</span>
                    <button className={s.compBtn} onClick={p.onFeeComp}>
                      Comp
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          <div className={s.chargeTo}>Charge {formatMoney(c.outOfPlan)} to</div>
          <div className={s.hows} role="radiogroup" aria-label="Charge to">
            {(['apt', 'card'] as const).map((h) => {
              const Icon = h === 'apt' ? Home : CreditCard;
              return (
                <button
                  key={h}
                  role="radio"
                  aria-checked={p.how === h}
                  className={cx(s.how, p.how === h && s.howOn)}
                  onClick={() => p.onHow(h)}
                >
                  <Icon size={15} strokeWidth={2} aria-hidden /> {payLabel(h, d, row.person)}
                </button>
              );
            })}
          </div>
          {p.tablePay === 'each' && p.how === 'card' && (
            <Terminal label="Square Terminal · Front desk" amount={c.outOfPlan} state={p.terminal} onState={p.onTerminal} />
          )}
        </div>
      )}
    </div>
  );
}

function FeeRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className={s.line}>
      <span className={s.lineName}>{label}</span>
      <span className={s.linePrice}>{formatMoney(amount)}</span>
    </div>
  );
}
