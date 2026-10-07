import type { ReactNode } from 'react';
import type { Order } from '../../../domain/types';
import { AwayOrders } from './AwayOrders';
import s from './MineView.module.css';

/** My Tables: the table board, or my pick up, delivery and associate meal orders (switched from the My tables button). */
export function MineView({
  showing,
  away,
  board,
  onOpen,
}: {
  showing: 'tables' | 'away';
  away: Order[];
  board: ReactNode;
  onOpen: (orderId: string) => void;
}) {
  if (showing === 'tables') return <>{board}</>;
  return (
    <div className={s.away}>
      <AwayOrders orders={away} onOpen={onOpen} />
    </div>
  );
}
