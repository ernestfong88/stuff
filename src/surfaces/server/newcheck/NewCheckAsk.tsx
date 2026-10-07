import { minutesSince } from '../../../lib/clock';
import { namesOf, tableName } from '../../../domain/orders';
import type { FloorTable, Order } from '../../../domain/types';
import { Button, Modal } from '../../../ui';
import s from './NewCheckAsk.module.css';

/**
 * Several checks on one table: a party that sits down later at the same
 * table gets its own check, with its own diners, pacing and timer.
 */
export function NewCheckAsk({
  table,
  mine,
  onNew,
  onOpen,
  onClose,
}: {
  table: FloorTable;
  /** My checks already open at the table. */
  mine: Order[];
  onNew: () => void;
  onOpen: (orderId: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} width={460} title={`Start a new check at ${table.label}?`} hideClose>
      <p className={s.lede}>
        You already have {mine.length === 1 ? 'a check' : `${mine.length} checks`} open here. A new check has its own diners, its own pacing and
        its own timer, for someone who sits down later.
      </p>
      <Button variant="primary" size="lg" block onClick={onNew} data-autofocus>
        Yes, start a new check
      </Button>
      <div className={s.list}>
        {mine.map((o) => (
          <button key={o.id} className={s.alt} onClick={() => onOpen(o.id)}>
            <span className={s.altTitle}>No, open {tableName(o)}</span>
            <span className={s.altNames}>{namesOf(o) || 'Seated'}</span>
            <span className={s.altMins}>{minutesSince(o.openedAt)}m</span>
          </button>
        ))}
      </div>
      <Button variant="ghost" block onClick={onClose}>
        Cancel
      </Button>
    </Modal>
  );
}
