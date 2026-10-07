/**
 * PU & Delivery: the pick up and delivery queue on a tablet at the to-go
 * counter. Orders line up by the 15 minute range they were promised for,
 * each showing the one thing it needs next.
 */
import { useState } from 'react';
import { TabletShell } from '../../shell/TabletShell';
import { useVenue } from '../../shell/session';
import { now } from '../../lib/clock';
import { useDining } from '../../store/dining';
import { OrderScreen } from '../server/order';
import { PudBoard } from './PudBoard';
import { mealAt } from './service/meals';

export default function PudSurface() {
  const { openQueueOrder } = useDining();
  const [venue] = useVenue();
  const [openId, setOpenId] = useState<string | null>(null);

  if (openId) return <OrderScreen orderId={openId} onClose={() => setOpenId(null)} />;

  return (
    <TabletShell>
      <PudBoard onOpen={setOpenId} onNew={(type) => setOpenId(openQueueOrder(type, venue, mealAt(now())))} />
    </TabletShell>
  );
}
