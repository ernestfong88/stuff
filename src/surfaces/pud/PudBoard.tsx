import { useMemo, useState } from 'react';
import { pickupLeadMinutes } from '../../domain/pickup';
import { startOfToday } from '../../lib/clock';
import { useView } from '../../shell/router';
import { useConfig } from '../../store/config';
import { useDining } from '../../store/dining';
import { toast, useConfirm, useNow } from '../../ui';
import { pickupWho } from '../../domain/pickup';
import type { Order } from '../../domain/types';
import { CompletedList } from './components/CompletedList';
import { OpenQueue } from './components/OpenQueue';
import { QueueToolbar } from './components/QueueToolbar';
import { completedToday, matchesFilter, openRows, type QueueFilter, type QueueRow } from './queue/queue';
import { usePudActions, useTextContext } from './queue/usePudActions';
import { tracksPickups, useServiceSettings } from '../../domain/pickupService/settings';
import s from './PudBoard.module.css';

const FILTERS: readonly QueueFilter[] = ['all', 'pickup', 'delivery'];

export interface PudBoardProps {
  onOpen: (orderId: string) => void;
  onNew: (type: 'pickup' | 'delivery') => void;
  /** Keep the filter here instead of in the URL (when the board sits inside another screen). */
  local?: boolean;
}

/** The list under the tablet header: #/pud/<filter>, plus /done for Completed today. */
export function PudBoard({ onOpen, onNew, local }: PudBoardProps) {
  const [routeView, setRouteView, rest] = useView<QueueFilter>('all');
  const [own, setOwn] = useState<{ view: QueueFilter; done: boolean }>({ view: 'all', done: false });
  const view = local ? own.view : routeView;
  const setView = (f: QueueFilter, more: string[] = []) => (local ? setOwn({ view: f, done: more[0] === 'done' }) : setRouteView(f, more));
  const filter: QueueFilter = FILTERS.includes(view) ? view : 'all';
  const showDone = local ? own.done : rest[0] === 'done';
  const at = useNow(15_000);
  const { orders, history, kitchenMode, setOrders, setHistory } = useDining();
  const [ask, confirmDialog] = useConfirm();

  /** Reopening changes today's numbers, so it asks first and can be undone. */
  const reopenCompleted = async (o: Order) => {
    const ok = await ask({
      title: `Reopen ${pickupWho(o)}'s ${o.queueType === 'delivery' ? 'delivery' : 'pick up'}?`,
      message: 'It goes back on the list as not handed off, and comes off Completed today, so you can correct it.',
      confirmLabel: 'Reopen',
    });
    if (!ok) return;
    reopen(o);
    setView(filter);
    onOpen(o.id);
    toast(`${pickupWho(o)}'s order is open again.`, {
      tone: 'success',
      action: {
        label: 'Undo',
        // Back to Completed today as it was, with its hand-off time.
        onClick: () => {
          setOrders((list) => list.filter((x) => x.id !== o.id));
          setHistory((list) => [o, ...list.filter((x) => x.id !== o.id)]);
        },
      },
    });
  };
  const cfg = useConfig();
  const svc = useServiceSettings();
  const ctx = useTextContext();

  const open = useMemo(() => openRows(orders, kitchenMode), [orders, kitchenMode]);
  const done = useMemo(() => completedToday(history, startOfToday()), [history]);
  const lead = useMemo(() => pickupLeadMinutes([...orders, ...history], cfg), [orders, history, cfg]);
  const { run, takeAll, reopen } = usePudActions(open, onOpen);

  const rows = open.filter((r) => matchesFilter(r.order, filter));
  const counts: Record<QueueFilter, number> = {
    all: open.length,
    pickup: open.filter((r) => r.order.queueType === 'pickup').length,
    delivery: open.filter((r) => r.order.queueType === 'delivery').length,
  };

  return (
    <div className={s.board}>
      <QueueToolbar
        filter={filter}
        onFilter={(f) => setView(f, showDone ? ['done'] : [])}
        counts={counts}
        completed={showDone}
        completedCount={done.length}
        onToggleCompleted={() => setView(filter, showDone ? [] : ['done'])}
        onNew={onNew}
      />
      <div className={s.scroll}>
        {showDone ? (
          <CompletedList
            list={done.filter((o) => matchesFilter(o, filter))}
            mobile={ctx.mobile}
            onReopen={(o) => void reopenCompleted(o)}
          />
        ) : (
          <OpenQueue
            rows={rows}
            filter={filter}
            at={at}
            ctx={ctx}
            leadMinutes={lead}
            tracksPickups={(room) => tracksPickups(svc, room)}
            onOpen={onOpen}
            onAction={(kind, r: QueueRow) => run(kind, r.order)}
            onTakeAll={takeAll}
          />
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
