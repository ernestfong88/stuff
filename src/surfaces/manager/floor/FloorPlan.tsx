import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../../../ui';
import type { PlanItem, RoomPlan } from './layout';
import s from './FloorPlan.module.css';

export interface FloorPlanProps {
  plan: RoomPlan;
  /** Draw one table. `box` places it; spread it into the element's style. */
  tile: (table: PlanItem, box: CSSProperties) => ReactNode;
  /** Smallest height before the plan scrolls (px). */
  minHeight?: number;
  /** Smaller section labels, for the plan inside a dialog. */
  compact?: boolean;
  className?: string;
}

/** Position of a plan item, in percent of the plan. */
export function planBox(t: Pick<PlanItem, 'x' | 'y' | 'w' | 'h'>): CSSProperties {
  return { position: 'absolute', left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%` };
}

/** __KFloorPlan: the room's sections, walls and tables; each screen draws its own tile. */
export function FloorPlan({ plan, tile, minHeight = 420, compact, className }: FloorPlanProps) {
  return (
    <div className={cx(s.plan, compact && s.compact, className)} style={{ minHeight }}>
      <div className={s.grid} aria-hidden="true" />
      {plan.bands.map((b) => (
        <div key={b.label} className={s.band} style={planBox(b)}>
          <span className={s.bandLabel}>{b.label}</span>
        </div>
      ))}
      {plan.items
        .filter((t) => t.type === 'wall')
        .map((w) => (
          <div key={w.id} className={s.wall} style={planBox(w)} aria-hidden="true" />
        ))}
      {plan.tables.map((t) => tile(t, planBox(t)))}
    </div>
  );
}
