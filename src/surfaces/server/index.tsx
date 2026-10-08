import { useMemo, useState } from 'react';
import { navigate, useRoute, useView } from '../../shell/router';
import { useMe, useVenue } from '../../shell/session';
import { TabletShell } from '../../shell/TabletShell';
import { useDiningActions, useDiningDevice, useDiningOrders } from '../../store/dining';
import { toast } from '../../ui';
import { MyTablesBoard } from './board/MyTablesBoard';
import type { OpenCheckOptions } from './board/TableCard';
import { NoticesButton, ResidentsView, ShiftReviewView, VoiceButton } from './features';
import { NewCheckView } from './newcheck/NewCheckView';
import { OrderScreen } from './order';
import { FullscreenLockButton, StartCheckButton } from './rail/RailButtons';
import { ServerNavLeft, ServerNavRight, type ServerView } from './ServerNav';
import { inVenue } from '../../domain/venue';
import { mealAt } from '../../domain/pickupService/meals';
import { now } from '../../lib/clock';
import { setMineMode, useMineMode, type MineMode } from '../../store/serverMine';
import { PudBoard } from '../pud/PudBoard';
import { openRows } from '../pud/queue/queue';
import { TablesView } from '../manager/tables/TablesView';
import { currentMeal } from './shared/meal';
import { TakeoverDialog } from './takeover/TakeoverDialog';

const VIEWS: readonly ServerView[] = ['mine', 'new', 'check', 'residents', 'shift'];

/** Open a check (one function for good, so My Tables' cards don't redraw for a new one). */
const openCheck = (orderId: string, opts?: OpenCheckOptions) =>
  navigate('server', ['check', orderId], { query: opts?.category ? { cat: opts.category } : undefined });

/**
 * Server tablet: My Tables, starting and taking checks, residents and the
 * shift review. Routes: #/server/mine, #/server/new, #/server/check/<id>,
 * #/server/residents, #/server/shift.
 */
export default function ServerSurface() {
  const [rawView, setView, rest] = useView<ServerView>('mine');
  const { query } = useRoute();
  const view: ServerView = VIEWS.includes(rawView) ? rawView : 'mine';
  const me = useMe().initials;
  const [venue] = useVenue();
  const { closeOrder, openQueueOrder, openOrder, patchOrder } = useDiningActions();
  const orders = useDiningOrders();
  const { kitchenMode } = useDiningDevice();
  const mode = useMineMode();
  const [viewServer, setViewServer] = useState(me);
  const live = useMemo(() => orders.filter((o) => !o.queueType && inVenue(o, venue)), [orders, venue]);
  const pudCount = useMemo(() => openRows(orders, kitchenMode).length, [orders, kitchenMode]);
  const counts: Record<MineMode, number> = {
    tables: live.filter((o) => o.server === me).length,
    pud: pudCount,
    map: live.length,
  };
  const goMine = (to?: MineMode) => {
    if (to) setMineMode(to);
    setViewServer(me);
    setView('mine');
  };

  if (view === 'check' && rest[0]) {
    // A pick up, delivery or associate meal left with nothing on it doesn't leave an empty order behind.
    const leave = () => {
      const o = orders.find((x) => x.id === rest[0]);
      // Back to My tables, in whichever view it was left on.
      navigate('server', ['mine']);
      if (o?.queueType && !o.diners.some((d) => d.items.length > 0)) {
        closeOrder(o.id);
        toast('Nothing was ordered, so the empty order was removed.');
      }
    };
    return <OrderScreen orderId={rest[0]} initialCategory={query.get('cat') ?? undefined} onClose={leave} />;
  }

  return (
    <TabletShell
      fitKey={`${view}:${mode}`}
      nav={
        <ServerNavLeft
          view={view}
          me={me}
          viewServer={viewServer}
          live={live}
          mode={mode}
          counts={counts}
          onMine={goMine}
          onViewServer={(id) => {
            setViewServer(id);
            setView('mine');
          }}
          onShift={() => setView('shift')}
        />
      }
      actions={<ServerNavRight view={view} onResidents={() => setView('residents')} onShift={() => setView('shift')} />}
      rail={
        <>
          <FullscreenLockButton />
          <NoticesButton />
          <VoiceButton />
          <StartCheckButton onStart={() => setView('new')} />
        </>
      }
    >
      {view === 'new' ? (
        <NewCheckView room={venue} me={me} onBack={() => goMine()} onOpen={(id) => openCheck(id)} />
      ) : view === 'residents' ? (
        <ResidentsView />
      ) : view === 'shift' ? (
        <ShiftReviewView />
      ) : mode === 'pud' ? (
        <PudBoard
          local
          onOpen={(id) => openCheck(id)}
          onNew={(type) => {
            const id = openQueueOrder(type, venue, mealAt(now()));
            patchOrder(id, { server: me });
            openCheck(id);
          }}
        />
      ) : mode === 'map' ? (
        <TablesView
          onOpen={(o) => openCheck(o.id)}
          onStart={(table) => {
            // Same as picking a free table on New check: open the check and go straight to the order.
            const id = openOrder(table.id, venue, currentMeal(), me);
            if (id) openCheck(id);
          }}
        />
      ) : (
        <MyTablesBoard room={venue} server={viewServer} me={me} onMine={() => goMine()} onOpen={openCheck} />
      )}
      <TakeoverDialog />
    </TabletShell>
  );
}
