import type { ReactNode } from 'react';
import type { Order } from '../../../domain/types';
import { Tabs } from '../../../ui';
import { AwayOrders } from './AwayOrders';
import s from './MineView.module.css';

/** My Tables, with a switch between my tables and my pick up, delivery and associate meal orders. */
export function MineView({
  showing,
  onShow,
  tables,
  away,
  board,
  onOpen,
}: {
  showing: 'tables' | 'away';
  onShow: (v: 'tables' | 'away') => void;
  tables: number;
  away: Order[];
  board: ReactNode;
  onOpen: (orderId: string) => void;
}) {
  return (
    <div className={s.view}>
      <div className={s.bar}>
        <Tabs
          variant="segmented"
          aria-label="Show"
          value={showing}
          onChange={onShow}
          options={[
            { id: 'tables', label: 'Tables', count: tables },
            { id: 'away', label: 'Pick up & delivery', count: away.length },
          ]}
        />
      </div>
      {showing === 'away' ? (
        <div className={s.away}>
          <AwayOrders orders={away} onOpen={onOpen} />
        </div>
      ) : (
        board
      )}
    </div>
  );
}
