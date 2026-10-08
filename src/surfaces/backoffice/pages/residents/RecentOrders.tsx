import { getItem } from '../../../../data';
import { tableName } from '../../../../domain/orders';
import { formatTime } from '../../../../lib/format';
import { useDiningHistory, useDiningOrders } from '../../../../store/dining';
import { BoSection } from '../../kit';
import s from './residents.module.css';

/** Today's checks this resident ate at, newest first. */
export function RecentOrders({ residentId }: { residentId: string | null }) {
  const orders = useDiningOrders();
  const history = useDiningHistory();
  const mine = residentId
    ? [...history, ...orders]
        .filter((o) => o.diners.some((d) => d.kind === 'resident' && !d.isGuest && d.refId === residentId))
        .sort((a, b) => (b.closedAt ?? b.openedAt) - (a.closedAt ?? a.openedAt))
        .slice(0, 6)
    : [];
  return (
    <BoSection title="Recent orders">
      {mine.length === 0 ? (
        <p className={s.muted}>No recent orders.</p>
      ) : (
        <ul className={s.orders}>
          {mine.map((o) => {
            const d = o.diners.find((x) => x.refId === residentId && !x.isGuest);
            const items = (d?.items ?? []).filter((l) => !l.autoSide && !l.cancelled).map((l) => getItem(l.itemId)?.name ?? 'Item');
            return (
              <li key={o.id} className={s.order}>
                <span className={s.orderItems}>{items.join(', ') || 'Nothing ordered yet'}</span>
                <span className={s.orderMeta}>
                  {tableName(o)} · {o.meal} · {formatTime(o.closedAt ?? o.openedAt)}
                  {!o.closedAt && ' · open'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </BoSection>
  );
}
