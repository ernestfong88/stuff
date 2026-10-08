import type { ReactNode } from 'react';
import { ShoppingBag, Truck } from 'lucide-react';
import { COMMUNITY_NAME } from '../../../data';
import { venueFee } from '../../../domain/billing';
import { hospiceWaivesFee, sickConfig, sickPeriodEnd, sickWaiversUsed } from '../../../domain/waivers';
import type { QueueType } from '../../../domain/types';
import { formatMoney } from '../../../lib/format';
import { useConfig } from '../../../store/config';
import { useDining } from '../../../store/dining';
import { useServiceSettings, windowSettings } from '../../../domain/pickupService/settings';
import { kioskVenue } from '../model/order';
import { KIOSK_ROOM, kioskTypes } from '../model/times';
import { KButton } from '../ui/KButton';
import { Question, TileGrid } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './TypeStep.module.css';

/** Pick up, delivery, and (with an allowance left) a delivery with the sick-tray fee waived. */
export function TypeStep({ flow }: { flow: KioskFlow }) {
  const cfg = useConfig();
  const svc = useServiceSettings();
  const { orders, history } = useDining();
  const r = flow.s.resident;
  const hospice = !!r && hospiceWaivesFee(r.id, cfg);
  const fee = hospice ? 0 : venueFee(KIOSK_ROOM, cfg).delivery;
  const sick = sickConfig(COMMUNITY_NAME, cfg);
  const used = r ? sickWaiversUsed(r.id, [...orders, ...history], undefined, cfg) : 0;
  const sickFull = used >= sick.allow;

  const tile = (type: QueueType, icon: ReactNode, title: string, sub: string, isSick = false, off = false) => {
    const on = flow.s.edit && flow.s.type === type && flow.s.sick === isSick;
    return (
      <KButton
        key={isSick ? 'sick' : type}
        column
        look={off ? 'off' : on ? 'selected' : 'secondary'}
        className={s.tile}
        onClick={() => flow.advance({ type, sick: isSick })}
      >
        {icon}
        <span className={s.title}>{title}</span>
        <span className={s.sub}>{sub}</span>
      </KButton>
    );
  };

  const deliverySub = `We bring it to Apt ${r?.apt ?? ''}. Times may vary.${hospice ? ' No delivery charge.' : fee ? ` A ${formatMoney(fee)} delivery charge applies.` : ''}`;
  const sickSub = sickFull
    ? `You have used all ${sick.allow} sick fee waivers until ${sickPeriodEnd()}. Choose Delivery, or call the dining room.`
    : `No delivery charge. ${used} of ${sick.allow} sick fee waivers used until ${sickPeriodEnd()}.`;
  const icon = (Icon: typeof Truck) => <Icon className={s.icon} strokeWidth={1.8} aria-hidden />;

  return (
    <div>
      <Question title="Pick up or delivery?" />
      <TileGrid min={340} gap={24}>
        {kioskTypes(windowSettings(svc)).flatMap((t) =>
          t === 'pickup'
            ? [tile('pickup', icon(ShoppingBag), 'Pick up', `Collect it from the ${kioskVenue()} Dining basket.`)]
            : [
                tile('delivery', icon(Truck), 'Delivery', deliverySub),
                ...(sick.on && fee > 0 && r ? [tile('delivery', icon(Truck), 'Delivery, I’m sick', sickSub, true, sickFull)] : []),
              ],
        )}
      </TileGrid>
    </div>
  );
}
