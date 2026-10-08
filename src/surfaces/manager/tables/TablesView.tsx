import type { CSSProperties } from 'react';
import { serverColor, serverName, serversOnFloor } from '../../../domain/servers';
import type { Order } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { formatElapsed } from '../../../lib/format';
import { useShared } from '../../../lib/sharedStore';
import { useVenue } from '../../../shell/session';
import { useConfig } from '../../../store/config';
import { useDining } from '../../../store/dining';
import { serviceConfig } from '../../../store/serviceConfig';
import { cx, useConfirm, useNow } from '../../../ui';
import { heldConfirm, heldWord, useHeldFor } from '../../server/newcheck/heldTable';
import type { Reservation } from '../../host/reservations/model';
import { FloorPlan } from '../floor/FloorPlan';
import { FLOOR_KEYS, floorState } from '../floor/floorState';
import { checksAt, inPlan, useRoomPlan, useTableName, type PlanItem } from '../../../store/floorLayout';
import { ServerLegend } from '../floor/ServerLegend';
import s from './TablesView.module.css';

/**
 * __KMgrFloor: every table in its stage colour with a timer, so the manager
 * sees at a glance where the room is. Tap a check to open it.
 */
export function TablesView({
  onOpen,
  onStart,
}: {
  onOpen: (o: Order) => void;
  /** Tapping a free table starts a check there (the server tablet). */ onStart?: (table: PlanItem) => void;
}) {
  const [venue] = useVenue();
  const plan = useRoomPlan(venue);
  const { orders } = useDining();
  const live = orders.filter((o) => !o.queueType && inPlan(o, plan));
  const heldAt = useHeldFor(venue);
  const [confirm, confirmDialog] = useConfirm();
  // A table the host is holding for a reservation: say so before starting a check there.
  const start = onStart
    ? async (table: PlanItem) => {
        const held = heldAt(table.id);
        if (held && !(await confirm(heldConfirm(table.label, held, now())))) return;
        onStart(table);
      }
    : undefined;

  return (
    <div className={s.wrap}>
      <div className={s.legends}>
        <ul className={s.stateLegend} aria-label="Colours">
          {FLOOR_KEYS.map((k) => (
            <li key={k.key}>
              <span className={cx(s.swatch, s[k.key])} />
              {k.label}
            </li>
          ))}
        </ul>
        <ServerLegend servers={serversOnFloor(live).filter((x) => x.open > 0)} />
      </div>
      <div className={s.planScroll}>
        <FloorPlan
          plan={plan}
          minHeight={520}
          tile={(t, box) => (
            <Tile key={t.id} table={t} box={box} checks={checksAt(live, t.id)} held={heldAt(t.id)} onOpen={onOpen} onStart={start} />
          )}
        />
      </div>
      {confirmDialog}
    </div>
  );
}

function Tile({
  table,
  box,
  checks,
  held,
  onOpen,
  onStart,
}: {
  table: PlanItem;
  box: CSSProperties;
  checks: Order[];
  /** The reservation the host is holding this free table for. */
  held: Reservation | null;
  onOpen: (o: Order) => void;
  onStart?: (table: PlanItem) => void;
}) {
  const cfg = useConfig();
  useShared(serviceConfig);
  const t = useNow(1000);
  const name = useTableName();
  const round = table.shape === 'round';

  if (!checks.length) {
    if (onStart)
      return (
        <button
          className={cx(s.tile, s.free, s.startable, held && s.held, round && s.round)}
          style={box}
          onClick={() => onStart(table)}
          aria-label={`${table.label}, ${held ? heldWord(held) : 'free'}. Start a check here`}
        >
          <span className={s.label}>{table.label}</span>
          {held && <span className={s.heldWord}>{heldWord(held)}</span>}
          <span className={s.freeWord}>+ New check</span>
        </button>
      );
    return (
      <div className={cx(s.tile, s.free, held && s.held, round && s.round)} style={box}>
        <span className={s.label}>{table.label}</span>
        <span className={s.freeWord}>{held ? heldWord(held) : 'Free'}</span>
      </div>
    );
  }

  if (checks.length === 1) {
    const o = checks[0];
    const st = floorState(o, cfg);
    return (
      <button
        className={cx(s.tile, s.one, s[st.key], round && s.round)}
        style={box}
        onClick={() => onOpen(o)}
        aria-label={`${name(o)}, ${serverName(o.server)}, ${st.word}, ${formatElapsed(t - st.since)}`}
      >
        {(st.key === 'run' || st.key === 'late') && <span className={cx(s.blip, st.key === 'run' && s.blink)} />}
        <span className={s.label}>{name(o)}</span>
        <span className={s.server}>
          <span className={s.srvDot} style={{ background: serverColor(o.server) }} />
          {serverName(o.server)}
        </span>
        <span className={s.word}>{st.word}</span>
        <span className={s.timer}>{formatElapsed(t - st.since)}</span>
      </button>
    );
  }

  const states = checks.map((o) => floorState(o, cfg));
  const worst = states.find((x) => x.key === 'late') ?? states[0];
  return (
    <div className={cx(s.tile, s.shared, s[`ring_${worst.key}`], round && s.round)} style={box}>
      <span className={s.sharedHead}>
        {table.label} · {checks.length} checks
      </span>
      <span className={s.split}>
        {checks.map((o, i) => (
          <button
            key={o.id}
            className={cx(s.part, s[states[i].key])}
            onClick={() => onOpen(o)}
            title={`${name(o)} · ${states[i].word}`}
            aria-label={`${name(o)}, ${serverName(o.server)}, ${states[i].word}`}
          >
            <span className={s.partTag}>
              {o.checkTag ? `${o.checkTag} · ` : ''}
              {o.server}
            </span>
            <span className={s.partTimer}>{formatElapsed(t - states[i].since)}</span>
          </button>
        ))}
      </span>
    </div>
  );
}
