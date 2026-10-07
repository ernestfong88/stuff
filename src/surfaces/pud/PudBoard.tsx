import { useMemo } from 'react';
import { pickupLeadMinutes } from '../../domain/pickup';
import { startOfToday } from '../../lib/clock';
import { useView } from '../../shell/router';
import { useConfig } from '../../store/config';
import { useDining } from '../../store/dining';
import { useNow } from '../../ui';
import { CompletedList } from './components/CompletedList';
import { OpenQueue } from './components/OpenQueue';
import { QueueToolbar } from './components/QueueToolbar';
import { completedToday, matchesFilter, openRows, type QueueFilter, type QueueRow } from './queue/queue';
import { usePudActions, useTextContext } from './queue/usePudActions';
import { tracksPickups, useServiceSettings } from './service/settings';
import s from './PudBoard.module.css';

const FILTERS: readonly QueueFilter[] = ['all', 'pickup', 'delivery'];

export interface PudBoardProps {
  onOpen: (orderId: string) => void;
  onNew: (type: 'pickup' | 'delivery') => void;
}

/** The list under the tablet header: #/pud/<filter>, plus /done for Completed today. */
export function PudBoard({ onOpen, onNew }: PudBoardProps) {
  const [view, setView, rest] = useView<QueueFilter>('all');
  const filter: QueueFilter = FILTERS.includes(view) ? view : 'all';
  const showDone = rest[0] === 'done';
  const at = useNow(15_000);
  const { orders, history, kitchenMode } = useDining();
  const cfg = useConfig();
  const svc = useServiceSettings();
  const ctx = useTextContext();

  const open = useMemo(() => openRows(orders, kitchenMode), [orders, kitchenMode]);
  const done = useMemo(() => completedToday(history, startOfToday()), [history]);
  const lead = useMemo(() => pickupLeadMinutes([...orders, ...history], cfg), [orders, history, cfg]);
  const { run, leave, reopen } = usePudActions(open, onOpen);

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
            onReopen={(o) => {
              reopen(o);
              setView(filter);
              onOpen(o.id);
            }}
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
            onTakeAll={(runs) => runs.forEach((r) => leave(r.order))}
          />
        )}
      </div>
    </div>
  );
}
