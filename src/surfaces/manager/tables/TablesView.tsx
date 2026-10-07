import type { CSSProperties } from 'react';
import { serverColor, serverName, serversOnFloor } from '../../../domain/servers';
import type { Order } from '../../../domain/types';
import { formatElapsed } from '../../../lib/format';
import { useShared } from '../../../lib/sharedStore';
import { useVenue } from '../../../shell/session';
import { useConfig } from '../../../store/config';
import { useDining } from '../../../store/dining';
import { serviceConfig } from '../../../store/serviceConfig';
import { cx, useNow } from '../../../ui';
import { FloorPlan } from '../floor/FloorPlan';
import { FLOOR_KEYS, floorState } from '../floor/floorState';
import { checksAt, inPlan, useRoomPlan, useTableName, type PlanItem } from '../floor/layout';
import { ServerLegend } from '../floor/ServerLegend';
import s from './TablesView.module.css';

/**
 * __KMgrFloor: every table in its stage colour with a timer, so the manager
 * sees at a glance where the room is. Tap a check to open it.
 */
export function TablesView({ onOpen }: { onOpen: (o: Order) => void }) {
  const [venue] = useVenue();
  const plan = useRoomPlan(venue);
  const { orders } = useDining();
  const live = orders.filter((o) => !o.queueType && inPlan(o, plan));

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
        <FloorPlan plan={plan} minHeight={520} tile={(t, box) => <Tile key={t.id} table={t} box={box} checks={checksAt(live, t.id)} onOpen={onOpen} />} />
      </div>
    </div>
  );
}

function Tile({ table, box, checks, onOpen }: { table: PlanItem; box: CSSProperties; checks: Order[]; onOpen: (o: Order) => void }) {
  const cfg = useConfig();
  useShared(serviceConfig);
  const t = useNow(1000);
  const name = useTableName();
  const round = table.shape === 'round';

  if (!checks.length) {
    return (
      <div className={cx(s.tile, s.free, round && s.round)} style={box}>
        <span className={s.label}>{table.label}</span>
        <span className={s.freeWord}>Free</span>
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
