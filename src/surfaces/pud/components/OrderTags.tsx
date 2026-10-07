import { hospiceOnOrder } from '../../../domain/waivers';
import type { Order } from '../../../domain/types';
import { useConfig } from '../../../store/config';
import { Chip } from '../../../ui';
import { lacksMobile } from '../../../domain/pickupService/texts';
import type { MobileOverrides } from '../../../domain/pickupService/phones';

/** Placed by the resident at the lobby kiosk. Other surfaces show this tag too. */
export function KioskTag({ order }: { order: Order }) {
  if (order.source !== 'kiosk') return null;
  return (
    <Chip tone="info" size="xs" title="Placed by the resident at the lobby kiosk">
      Kiosk
    </Chip>
  );
}

/** " · utensils" / " · no utensils" after a kiosk order's items. */
export function utensilsText(order: Order): string {
  if (order.source !== 'kiosk') return '';
  return order.utensils ? ' · utensils' : ' · no utensils';
}

/** The tags after the resident's name: no mobile, kiosk, fee waived. */
export function OrderTags({ order, mobile }: { order: Order; mobile: MobileOverrides }) {
  const cfg = useConfig();
  const hospice = hospiceOnOrder(order, cfg);
  return (
    <>
      {lacksMobile(order, mobile) && (
        <Chip tone="warning" size="xs" title="No mobile on file, so nothing is texted. Let them know another way.">
          No mobile
        </Chip>
      )}
      <KioskTag order={order} />
      {(hospice || order.sickTray) && (
        <Chip tone={hospice ? 'plum' : 'info'} size="xs">
          {hospice ? 'Hospice · fee waived' : 'Fee waived · sick'}
        </Chip>
      )}
    </>
  );
}
