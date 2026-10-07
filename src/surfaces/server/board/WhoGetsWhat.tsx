import type { ReactNode } from 'react';
import { getItem } from '../../../data';
import { modsText, serverItemName } from '../../../domain/menu';
import { dinerName } from '../../../domain/orders';
import type { Diner, Order, OrderLine } from '../../../domain/types';
import { useConfig } from '../../../store/config';
import { ReminderChips } from '../shared/ReminderChips';
import s from './WhoGetsWhat.module.css';

export interface PlateGroup {
  diner: Diner;
  lines: OrderLine[];
}

/**
 * Name first, then that person's plates, so the server can carry the tray
 * without opening the check. `muted` greys the list (the cook's plates).
 */
export function WhoGetsWhat({
  order,
  groups,
  muted,
  tag,
}: {
  order: Order;
  groups: PlateGroup[];
  muted?: boolean;
  /** Extra label after a line, e.g. "At the bar". */
  tag?: (line: OrderLine) => ReactNode;
}) {
  const cfg = useConfig();
  return (
    <div className={muted ? s.muted : undefined}>
      {groups.map((g) => (
        <div key={g.diner.id} className={s.group}>
          <div className={s.who}>{dinerName(g.diner).split(' ')[0]}</div>
          {g.lines.map((line) => {
            const mods = modsText(line.mods, line.note);
            return (
              <div key={line.id} className={s.line}>
                <span className={s.name}>
                  {serverItemName(getItem(line.itemId)?.name ?? 'Item', cfg)}
                  {mods && <span className={s.mods}> · {mods}</span>}
                </span>
                {tag?.(line)}
                <ReminderChips order={order} line={line} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
