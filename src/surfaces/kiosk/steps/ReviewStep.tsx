import { ChevronRight } from 'lucide-react';
import type { DinerBilling } from '../../../domain/billing';
import type { KioskMenu } from '../../../domain/kioskMenu';
import type { Order } from '../../../domain/types';
import { cx } from '../../../ui';
import { maskPhone } from '../../../domain/pickupService/phones';
import { planSentence } from '../model/order';
import { reviewLines } from '../model/review';
import { Question } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './ReviewStep.module.css';

export interface ReviewStepProps {
  flow: KioskFlow;
  menu: KioskMenu | null;
  /** The order as it would be placed. */
  order: Order;
  bill: DinerBilling;
  /** Hospice waives the delivery fee on this order. */
  hospice: boolean;
  /** The mobile a copy would go to, or "" when no copy can be texted. */
  mobile: string;
  today: string;
}

/**
 * "Please check your order": one answer to a line, each tappable to change
 * it, then the plan sentence and Text me a copy.
 */
export function ReviewStep({ flow, menu, order, bill, hospice, mobile, today }: ReviewStepProps) {
  const st = flow.s;
  const r = st.resident;
  const on = st.textCopy;
  const fee = hospice ? ' No delivery charge.' : order.sickTray ? ' Delivery fee waived (sick).' : '';
  return (
    <div>
      <Question title="Please check your order" sub={`${r ? `${r.name} · Apt ${r.apt}. ` : ''}Tap a line to change it.`} tight />
      <ul className={s.lines}>
        {reviewLines(st, menu, today).map((l) => (
          <li key={l.key}>
            <button type="button" className={s.line} onClick={() => flow.go(l.to, { edit: true, ...l.patch })}>
              <span className={s.label}>{l.label}</span>
              <span className={s.value}>{l.value}</span>
              <span className={s.change}>
                Change
                <ChevronRight size="1.1em" strokeWidth={2.6} aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className={s.plan}>{planSentence(r, bill) + fee}</p>
      {mobile && (
        <button type="button" role="switch" aria-checked={on} className={s.textCopy} onClick={() => flow.put({ textCopy: !on })}>
          <span className={s.textLabel}>
            <span className={s.textTitle}>Text me a copy</span>
            <span className={s.textTo}>{on ? `to ${maskPhone(mobile)}` : 'Off for this order'}</span>
          </span>
          <span className={cx(s.state, on && s.stateOn)}>
            {on ? 'On' : 'Off'}
            <span className={cx(s.track, on && s.trackOn)}>
              <span className={s.knob} />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
