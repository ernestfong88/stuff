import type { DinerBilling } from '../../../domain/billing';
import type { Order } from '../../../domain/types';
import { cx } from '../../../ui';
import { maskPhone } from '../../pud/service/phones';
import { planSentence, reviewItems, reviewWhen } from '../model/order';
import { Panel, Question } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './ReviewStep.module.css';

export interface ReviewStepProps {
  flow: KioskFlow;
  /** The order as it would be placed. */
  order: Order;
  bill: DinerBilling;
  /** Hospice waives the delivery fee on this order. */
  hospice: boolean;
  /** The mobile a copy would go to, or "" when no copy can be texted. */
  mobile: string;
  today: string;
}

/** "Please check your order": when and where, what, the plan sentence, and Text me a copy. */
export function ReviewStep({ flow, order, bill, hospice, mobile, today }: ReviewStepProps) {
  const st = flow.s;
  const r = st.resident;
  const items = reviewItems(st);
  const on = st.textCopy;
  const fee = hospice ? ' No delivery charge.' : order.sickTray ? ' Delivery fee waived (sick).' : '';
  return (
    <div>
      <Question title="Please check your order" sub={r ? `${r.name} · Apt ${r.apt}` : undefined} tight />
      <Panel className={s.summary}>
        <p className={s.when}>{reviewWhen(st, today)}</p>
        <p className={s.items}>{items.length ? items.join(' · ') : 'No food or drink yet'}</p>
        {st.note && <p className={s.line}>Changes: {st.note}</p>}
        <p className={s.line}>Utensils: {st.utensils ? 'yes' : 'no'}</p>
      </Panel>
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
