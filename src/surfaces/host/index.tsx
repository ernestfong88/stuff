/**
 * Host tablet: seat parties on the floor (each open check in its server's
 * colour, with a suggested server) and keep the reservation book.
 */
import type { Order } from '../../domain/types';
import { useView } from '../../shell/router';
import { TabletShell } from '../../shell/TabletShell';
import { OrderScreen } from '../server/order';
import type { HostTab } from './HostTabs';
import { HostView } from './HostView';

export default function HostSurface() {
  const [view, setView, rest] = useView<HostTab>('floor');
  const tab: HostTab = view === 'reservations' ? 'reservations' : 'floor';
  const openId = rest[0] === 'check' ? rest[1] : undefined;

  if (openId) return <OrderScreen orderId={openId} onClose={() => setView(tab)} />;

  return (
    <TabletShell>
      <HostView tab={tab} onTab={setView} onOpen={(o: Order) => setView(tab, ['check', o.id])} />
    </TabletShell>
  );
}
