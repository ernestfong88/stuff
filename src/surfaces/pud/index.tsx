/**
 * PU & Delivery: the pick up and delivery queue on a tablet at the to-go
 * counter. Orders line up by the 15 minute range they were promised for,
 * each showing the one thing it needs next.
 */
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { navigate } from '../../shell/router';
import { TabletShell } from '../../shell/TabletShell';
import { useVenue } from '../../shell/session';
import { now } from '../../lib/clock';
import { useDining } from '../../store/dining';
import { setMineMode } from '../../store/serverMine';
import { Button, toast } from '../../ui';
import { OrderScreen } from '../server/order';
import { PudBoard } from './PudBoard';
import { isEmptyOrder } from './queue/queue';
import { mealAt } from '../../domain/pickupService/meals';

export default function PudSurface() {
  const { orders, openQueueOrder, closeOrder } = useDining();
  const [venue] = useVenue();
  const [openId, setOpenId] = useState<string | null>(null);

  // Leaving a new order with nothing on it doesn't leave an empty "Not sent yet" row behind.
  const close = () => {
    const o = orders.find((x) => x.id === openId);
    setOpenId(null);
    if (o && isEmptyOrder(o)) {
      closeOrder(o.id);
      toast('Nothing was ordered, so the empty order was removed.');
    }
  };

  if (openId) return <OrderScreen orderId={openId} onClose={close} />;

  return (
    <TabletShell
      nav={
        <Button
          icon={<ArrowLeft size={16} strokeWidth={2.25} />}
          onClick={() => {
            setMineMode('tables');
            navigate('server', ['mine']);
          }}
        >
          My tables
        </Button>
      }
    >
      <PudBoard onOpen={setOpenId} onNew={(type) => setOpenId(openQueueOrder(type, venue, mealAt(now())))} />
    </TabletShell>
  );
}
