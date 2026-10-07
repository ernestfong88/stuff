import { ClipboardList, Eye } from 'lucide-react';
import { dinerBilling } from '../../../domain/billing';
import { printerMode, type DiningConfig } from '../../../domain/config';
import type { Order } from '../../../domain/types';
import { serverName } from '../../../domain/servers';
import { useConfig } from '../../../store/config';
import { useDining } from '../../../store/dining';
import { cx, EmptyState, useNow } from '../../../ui';
import { inVenue } from '../../../domain/venue';
import s from './MyTablesBoard.module.css';
import { TableCard, type OpenCheckOptions } from './TableCard';
import { LANES, stageSince, tableStage, type StageKey, type TableStage } from '../../../domain/tableStage';

/** Quick close is offered when every diner is a resident on plan with nothing to charge. */
export function isCovered(o: Order, cfg: DiningConfig): boolean {
  return o.diners.length > 0 && o.diners.every((d) => d.kind === 'resident' && !d.isGuest && dinerBilling(d, o, cfg).outOfPlan === 0);
}

interface Row {
  order: Order;
  stage: TableStage;
  since: number;
}

/**
 * My Tables as the action center, laid out as stage lanes. A table only
 * ever changes lane, never jumps inside one: a lane is ordered by when each
 * table entered that stage. Ready to run is the loud lane.
 */
export function MyTablesBoard({
  room,
  server,
  me,
  onMine,
  onOpen,
}: {
  room: string;
  /** Initials of the server whose tables are shown. */
  server: string;
  /** Initials of the signed-in server; another server's board says whose it is. */
  me?: string;
  /** Back to my own tables from another server's. */
  onMine?: () => void;
  onOpen: (orderId: string, opts?: OpenCheckOptions) => void;
}) {
  const { orders } = useDining();
  const cfg = useConfig();
  const at = useNow(5000);
  const mine = orders.filter((o) => !o.queueType && inVenue(o, room) && o.server === server);
  const rows: Row[] = mine.map((order) => {
    const stage = tableStage(order, cfg, at);
    return { order, stage, since: stageSince(order, stage) };
  });
  const byLane = new Map<StageKey, Row[]>();
  for (const r of rows) byLane.set(r.stage.key, [...(byLane.get(r.stage.key) ?? []), r]);

  const banner =
    me && server !== me ? (
      <div className={s.others} role="status">
        <Eye size={16} aria-hidden />
        <span className={s.othersText}>
          <b>{serverName(server)}'s tables.</b> Changing one of these checks asks to take it over.
        </span>
        {onMine && (
          <button className={s.othersBack} onClick={onMine}>
            Back to my tables
          </button>
        )}
      </div>
    ) : null;

  if (!rows.length) {
    return (
      <div className={s.board}>
        {banner}
        <EmptyState icon={<ClipboardList size={28} />} title={`No open checks for ${serverName(server)}`}>
          Start one from the floor.
        </EmptyState>
      </div>
    );
  }

  // Printers: tickets print whole and nothing tracks them, so no stage lanes, just the open checks, oldest first.
  if (printerMode(cfg)) {
    const list = [...rows].sort((a, b) => a.order.openedAt - b.order.openedAt);
    return (
      <div className={cx(s.board, 'scroll')}>
        {banner}
        <section className={cx(s.lane, s.lane_plain)} aria-label="Open checks">
          <h2 className={s.laneHead}>
            <span className={s.dot} aria-hidden />
            Open checks
          </h2>
          <div className={s.grid}>
            {list.map((r) => (
              <TableCard key={r.order.id} order={r.order} stage={r.stage} since={r.order.openedAt} covered={isCovered(r.order, cfg)} onOpen={onOpen} plain />
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={cx(s.board, 'scroll')}>
      {banner}
      {LANES.map((lane) => {
        const list = (byLane.get(lane.key) ?? []).sort((a, b) => a.since - b.since || a.order.openedAt - b.order.openedAt);
        if (!list.length) return null;
        return (
          <section key={lane.key} className={cx(s.lane, s[`lane_${lane.key}`], lane.key === 'run' && s.loud)} aria-label={lane.label}>
            <h2 className={s.laneHead}>
              <span className={s.dot} aria-hidden />
              {lane.label}
            </h2>
            <div className={s.grid}>
              {list.map((r) => (
                <TableCard
                  key={r.order.id}
                  order={r.order}
                  stage={r.stage}
                  since={r.since}
                  covered={isCovered(r.order, cfg)}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
