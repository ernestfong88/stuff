import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Order } from '../../../domain/types';
import { needsTakeover, type LoggedAction } from '../../../domain/activityLog';
import { serverName } from '../../../domain/servers';
import { checkInWakeMinutes, tableRoom, venueHasExpo } from '../../../domain/venue';
import { useConfig } from '../../../store/config';
import { useDining } from '../../../store/dining';
import { serviceConfig } from '../../../store/serviceConfig';
import { sessionStore } from '../../../store/session';
import { now } from '../../../lib/clock';
import { useShared } from '../../../lib/sharedStore';
import { Button, Eyebrow, EmptyState, Tabs, cx, toast, useNow } from '../../../ui';
import { useTableName } from '../../../store/floorLayout';
import { cardActions } from '../../server/board/cardActions';
import { isCovered } from '../../server/board/MyTablesBoard';
import { drinkQueue } from '../../server/shared/lines';
import { TakeoverDialog } from '../../server/takeover/TakeoverDialog';
import { courseWord, tableStage } from '../floor/stage';
import { triageByServer, triageRows, type ServerTriage } from '../floor/triage';
import { loadText, needText, pickupIssues, rowActionLabel, rowActions, tableItem, triageGroups, type RowAction, type TriageItem } from './triageList';
import s from './TriageView.module.css';

type TriageMode = 'table' | 'assoc';

/** __KTriage: what the manager should do next, most urgent first, by table or by associate. */
export function TriageView({ onOpen }: { onOpen: (o: Order) => void }) {
  const { orders, kitchenMode } = useDining();
  const cfg = useConfig();
  // Thresholds live in the service config: re-render when Back Office changes them,
  // and every 15 seconds so the minutes keep counting.
  useShared(serviceConfig);
  useNow(15_000);
  const [mode, setMode] = useState<TriageMode>('table');
  const [showFine, setShowFine] = useState(false);
  const name = useTableName();

  const rows = triageRows(orders, { cfg });
  const g = triageGroups(rows, name, pickupIssues(orders, kitchenMode));
  const open = g.now.length + g.soon.length + g.kitchen.length;

  return (
    <div className={s.scroll}>
      <div className={s.head}>
        <Tabs<TriageMode>
          variant="segmented"
          size="md"
          value={mode}
          onChange={setMode}
          aria-label="Group triage"
          options={[
            { id: 'table', label: 'By table' },
            { id: 'assoc', label: 'By associate' },
          ]}
        />
        {rows.length > 0 && !open && <span className={s.calm}>Nothing needs you right now</span>}
      </div>

      {!rows.length && !g.kitchen.length ? (
        <EmptyState title="No tables open">Open checks show here when a table needs a hand.</EmptyState>
      ) : mode === 'table' ? (
        <>
          <Group title="Now" tone="late" items={g.now} name={name} onOpen={onOpen} />
          <Group title="Soon" tone="watch" items={g.soon} name={name} onOpen={onOpen} />
          <Group title="Kitchen" items={g.kitchen} name={name} onOpen={onOpen} />
          {g.fine.length > 0 && (
            <div className={s.fine}>
              <button className={s.fineToggle} aria-expanded={showFine} onClick={() => setShowFine((v) => !v)}>
                Fine for now ({g.fine.length})
                <ChevronDown size={15} aria-hidden className={cx(s.chev, showFine && s.chevOpen)} />
              </button>
              {showFine && (
                <div className={s.fineList}>
                  {g.fine.map((r) => (
                    <button key={r.order.id} className={s.chip} onClick={() => onOpen(r.order)}>
                      {name(r.order)}
                      <span className={s.chipWho}>{serverName(r.order.server)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <ul className={s.servers}>
          {triageByServer(rows).map((x) => (
            <ServerRow key={x.server} data={x} name={name} onOpen={onOpen} />
          ))}
        </ul>
      )}
      <TakeoverDialog />
    </div>
  );
}

function Group({
  title,
  tone,
  items,
  name,
  onOpen,
}: {
  title: string;
  tone?: 'late' | 'watch';
  items: TriageItem[];
  name: (o: Order) => string;
  onOpen: (o: Order) => void;
}) {
  if (!items.length) return null;
  return (
    <section className={s.group} aria-label={title}>
      <Eyebrow className={cx(s.groupHead, tone === 'late' && s.red, tone === 'watch' && s.amber)}>
        {title} <span className={s.count}>{items.length}</span>
      </Eyebrow>
      <ul className={s.list}>
        {items.map((x) => (
          <ItemRow key={x.key} item={x} name={name(x.order)} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}

function ItemRow({ item: x, name, onOpen }: { item: TriageItem; name: string; onOpen: (o: Order) => void }) {
  const cfg = useConfig();
  const dining = useDining();
  const o = x.order;
  const acts =
    x.kind === 'pickup'
      ? []
      : rowActions(
          x.kind,
          cardActions(o, {
            stage: tableStage(o, cfg).key,
            covered: isCovered(o, cfg),
            hasExpo: venueHasExpo(tableRoom(o)),
            checkInWakeMin: checkInWakeMinutes(o.room),
            now: now(),
            cfg,
          }),
        );

  // A server's own check changes at once; anyone else's asks first (Take over?), and that dialog is the feedback.
  const asks = (action: LoggedAction) => {
    const { me, mode } = sessionStore.get();
    return needsTakeover(action, o, me, mode);
  };
  const done = (msg: string, undo?: () => void) => toast(msg, { tone: 'success', action: undo ? { label: 'Undo', onClick: undo } : undefined });

  const run = (a: RowAction) => {
    switch (a.kind) {
      case 'served': {
        const asking = asks('runCourse');
        dining.markServed(o.id, a.course);
        if (asking) return;
        const undo = dining.runUndoFor(o.id);
        return done(`${courseWord(a.course)} run to ${name}`, undo ? () => dining.undoRunCourse(o.id, a.course, undo) : undefined);
      }
      case 'checkIn': {
        const asking = asks('checkIn');
        dining.checkIn(o.id, a.course);
        return asking ? undefined : done(`Checked in with ${name}`);
      }
      case 'drinks': {
        const asking = asks('serveDrinks');
        const q = drinkQueue(o, cfg.barScreen !== false);
        dining.serveDrinks(
          o.id,
          [...q.pour, ...q.up].map((d) => d.line.id),
        );
        return asking ? undefined : done(`Drinks out to ${name}`);
      }
      case 'quickClose': {
        const asking = asks('closeOrder');
        dining.closeOrder(o.id, {});
        return asking ? undefined : done(`${name} closed on the meal plan`, () => dining.reopenOrder(o.id));
      }
      case 'fire': {
        const asking = asks('fireCourseNow');
        a.fireAs.forEach((c) => dining.fireCourseNow(o.id, c));
        return asking ? undefined : done(`${a.label.replace(/^Fire/, 'Fired')} for ${name}`);
      }
    }
  };

  return (
    <li className={cx(s.row, x.late ? s.lateEdge : s.watchEdge)}>
      <button className={s.main} onClick={() => onOpen(o)}>
        <span className={s.what}>
          <span className={s.label}>{x.label}</span>
          {x.also.length > 0 && <span className={s.also}>{x.also.join(' · ')}</span>}
        </span>
        <span className={s.who}>{x.server ? serverName(x.server) : x.due}</span>
        <span className={cx(s.mins, x.late ? s.red : s.amber)}>{x.mins} min</span>
      </button>
      <span className={s.acts}>
        {acts.map((a) => (
          <Button key={a.kind} size="md" variant={a.kind === 'quickClose' ? 'soft' : 'softSuccess'} onClick={() => run(a)}>
            {rowActionLabel(a)}
          </Button>
        ))}
      </span>
    </li>
  );
}

function ServerRow({ data, name, onOpen }: { data: ServerTriage; name: (o: Order) => string; onOpen: (o: Order) => void }) {
  const [worst, ...rest] = data.need;
  const w = worst && tableItem(worst, name(worst.order));
  const tone = data.late ? s.red : data.need.length ? s.amber : s.green;
  return (
    <li className={cx(s.server, data.late ? s.lateEdge : data.need.length ? s.watchEdge : s.goodEdge)}>
      <span className={s.serverName}>{serverName(data.server)}</span>
      <span className={cx(s.need, tone)}>{needText(data)}</span>
      {w && (
        <button className={s.worst} onClick={() => onOpen(w.order)}>
          <span className={s.worstLabel}>{w.label}</span>
          <span className={cx(s.mins, w.late ? s.red : s.amber)}>{w.mins} min</span>
        </button>
      )}
      {rest.map((r) => (
        <button
          key={r.order.id}
          className={cx(s.chip, r.why[0].late ? s.chipLate : s.chipWatch)}
          onClick={() => onOpen(r.order)}
          title={r.why[0].text}
        >
          {name(r.order)}
        </button>
      ))}
      <span className={s.load}>{loadText(data)}</span>
    </li>
  );
}
