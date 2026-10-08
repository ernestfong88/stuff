/**
 * Manager tablet: Triage, the floor, Steps of Service metrics, the closing
 * report, associate meals and the 86 list. The header keeps the server
 * tablet's own buttons (my tables, points, menu, residents, shift review),
 * because a manager also takes tables.
 */
import type { Order } from '../../domain/types';
import { useView } from '../../shell/router';
import { useMe, useVenue } from '../../shell/session';
import { useDining } from '../../store/dining';
import { currentMeal } from '../server/shared/meal';
import { TabletShell } from '../../shell/TabletShell';
import { NoticesButton, ResidentsView, ShiftReviewView } from '../server/features';
import { OrderScreen } from '../server/order';
import { AssociatesView } from './associates/AssociatesView';
import { EightySixView } from './eightySix/EightySixView';
import { ManagerActions, ManagerNav } from './ManagerHeader';
import { MANAGER_TABS, ManagerTabs, type ManagerTab } from './ManagerTabs';
import { MetricsView } from './metrics/MetricsView';
import { ShiftView } from './shift/ShiftView';
import { TablesView } from './tables/TablesView';
import { TriageView } from './triage/TriageView';

type ManagerView = ManagerTab | 'residents' | 'review';

const isTab = (v: string): v is ManagerTab => MANAGER_TABS.some((t) => t.id === v);

export default function ManagerSurface() {
  const [view, setView, rest] = useView<ManagerView>('triage');
  const openId = rest[0] === 'check' ? rest[1] : undefined;
  const open = (o: Order) => setView(view, ['check', o.id]);
  const me = useMe().initials;
  const [venue] = useVenue();
  const { openOrder } = useDining();

  if (openId) return <OrderScreen orderId={openId} onClose={() => setView(view)} />;

  return (
    <TabletShell
      fitKey={view}
      nav={<ManagerNav onPoints={() => setView('review')} />}
      actions={<ManagerActions view={view} onResidents={() => setView('residents')} onReview={() => setView('review')} />}
      rail={<NoticesButton />}
    >
      <ManagerTabs value={isTab(view) ? view : null} onChange={setView} />
      {view === 'tables' ? (
        <TablesView
          onOpen={open}
          onStart={(table) => {
            // A manager also takes tables: a free table starts their own check, as on the server's map.
            const id = openOrder(table.id, venue, currentMeal(), me);
            if (id) setView(view, ['check', id]);
          }}
        />
      ) : view === 'metrics' ? (
        <MetricsView onOpen={open} />
      ) : view === 'shift' ? (
        <ShiftView onOpen={open} />
      ) : view === 'associates' ? (
        <AssociatesView />
      ) : view === '86' ? (
        <EightySixView />
      ) : view === 'residents' ? (
        <ResidentsView />
      ) : view === 'review' ? (
        <ShiftReviewView />
      ) : (
        <TriageView onOpen={open} />
      )}
    </TabletShell>
  );
}
