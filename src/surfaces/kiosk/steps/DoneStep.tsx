import { Check } from 'lucide-react';
import { hasMobile, maskPhone } from '../../../domain/pickupService/phones';
import { mobileOverrides, useServiceSettings } from '../../../domain/pickupService/settings';
import { rangeLabel } from '../../../domain/pickupService/windows';
import { kioskVenue } from '../model/order';
import { KButton } from '../ui/KButton';
import { Panel } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './DoneStep.module.css';

/** "Thank you, Eleanor." with when it will be ready, and the text we sent. */
export function DoneStep({ flow, today, onShowText }: { flow: KioskFlow; today: boolean; onShowText: () => void }) {
  const st = flow.s;
  const r = st.resident;
  const svc = useServiceSettings();
  const meal = `${String(st.meal ?? 'meal').toLowerCase()}${today ? '' : ' tomorrow'}`;
  const range = st.win != null ? rangeLabel(st.win) : '';
  const texts = !!r && hasMobile(mobileOverrides(svc), r.id);
  const later = st.type === 'delivery' ? "We'll text you again when it's on the way." : "We'll text you again when it's ready.";
  return (
    <div className={s.done}>
      {!st.showSms && (
        <span className={s.badge} aria-hidden>
          <Check size="60%" strokeWidth={3} />
        </span>
      )}
      <h1 className={s.title}>Thank you, {r?.name.split(' ')[0]}.</h1>
      <p className={s.when}>
        {st.type === 'delivery'
          ? `Your ${meal} will arrive at Apt ${r?.apt ?? ''} ${range}. Times may vary.`
          : `Your ${meal} will be ready ${range} at the ${kioskVenue()} Dining basket.`}
      </p>
      {st.sms && <p className={s.texted}>We texted a copy of your order to {maskPhone(st.sms.to)}.</p>}
      {texts && <p className={s.later}>{st.sms ? later : later.replace(' again', '')}</p>}
      {st.sms &&
        (st.showSms ? (
          <Panel className={s.text}>
            <div className={s.textCaption}>Your text</div>
            <div className={s.bubble}>{st.sms.body}</div>
          </Panel>
        ) : (
          <KButton className={s.see} onClick={onShowText}>
            See the text
          </KButton>
        ))}
    </div>
  );
}
