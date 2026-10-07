import { useState } from 'react';
import { navigate, useRoute, useView } from '../../shell/router';
import { useMe, useVenue } from '../../shell/session';
import { TabletShell } from '../../shell/TabletShell';
import { useDining } from '../../store/dining';
import { toast } from '../../ui';
import { MyTablesBoard } from './board/MyTablesBoard';
import type { OpenCheckOptions } from './board/TableCard';
import { NoticesButton, ResidentsView, ShiftReviewView, VoiceButton } from './features';
import { NewCheckView } from './newcheck/NewCheckView';
import { OrderScreen } from './order';
import { FullscreenLockButton, StartCheckButton } from './rail/RailButtons';
import { ServerNavLeft, ServerNavRight, type ServerView } from './ServerNav';
import { inVenue } from '../../domain/venue';
import { TakeoverDialog } from './takeover/TakeoverDialog';

const VIEWS: readonly ServerView[] = ['mine', 'new', 'check', 'residents', 'shift'];

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
  const { orders, closeOrder } = useDining();
  const [viewServer, setViewServer] = useState(me);
  const live = orders.filter((o) => !o.queueType && inVenue(o, venue));

  const openCheck = (orderId: string, opts?: OpenCheckOptions) =>
    navigate('server', ['check', orderId], { query: opts?.category ? { cat: opts.category } : undefined });
  const goMine = () => {
    setViewServer(me);
    setView('mine');
  };

  if (view === 'check' && rest[0]) {
    // A pick up, delivery or associate meal left with nothing on it doesn't leave an empty order behind.
    const leave = () => {
      const o = orders.find((x) => x.id === rest[0]);
      setView('mine');
      if (o?.queueType && !o.diners.some((d) => d.items.length > 0)) {
        closeOrder(o.id);
        toast('Nothing was ordered, so the empty order was removed.');
      }
    };
    return <OrderScreen orderId={rest[0]} initialCategory={query.get('cat') ?? undefined} onClose={leave} />;
  }

  return (
    <TabletShell
      nav={
        <ServerNavLeft
          view={view}
          me={me}
          viewServer={viewServer}
          live={live}
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
        <NewCheckView room={venue} me={me} onBack={goMine} onOpen={(id) => openCheck(id)} />
      ) : view === 'residents' ? (
        <ResidentsView />
      ) : view === 'shift' ? (
        <ShiftReviewView />
      ) : (
        <MyTablesBoard room={venue} server={viewServer} me={me} onMine={goMine} onOpen={openCheck} />
      )}
      <TakeoverDialog />
    </TabletShell>
  );
}
