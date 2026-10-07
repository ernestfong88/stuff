import { GlassWater } from 'lucide-react';
import { serverItems } from '../../../domain/courses';
import { tableName } from '../../../domain/orders';
import type { Order } from '../../../domain/types';
import { useConfig } from '../../../store/config';
import { Button, Chip, Modal } from '../../../ui';
import { byDiner, type DrinkQueue } from '../shared/lines';
import s from './CardDialogs.module.css';
import { WhoGetsWhat } from './WhoGetsWhat';

/** Get Drinks: who gets what, by first name, then mark them delivered. */
export function DrinksDialog({
  order,
  queue,
  onClose,
  onDone,
}: {
  order: Order;
  queue: DrinkQueue;
  onClose: () => void;
  onDone: () => void;
}) {
  const groups = byDiner([...queue.pour, ...queue.up]).map((g) => ({ diner: g.diner, lines: g.rows.map((r) => r.line) }));
  return (
    <Modal
      open
      onClose={onClose}
      width={440}
      title={
        <span className={s.title}>
          <GlassWater size={18} className={s.glass} aria-hidden />
          Drinks for {tableName(order)}
        </span>
      }
      footer={
        <>
          <Button size="lg" onClick={onClose} className={s.grow}>
            Not yet
          </Button>
          <Button size="lg" variant="success" onClick={onDone} className={s.grow} data-autofocus>
            Drinks delivered
          </Button>
        </>
      }
    >
      <WhoGetsWhat
        order={order}
        groups={groups}
        tag={(line) =>
          line.kitchenState === 'up' ? (
            <Chip size="xs" tone="success">
              At the bar
            </Chip>
          ) : null
        }
      />
    </Modal>
  );
}

/**
 * Get items: when a course has things the server makes, list who gets what
 * before the course is run. `info` when Expo runs the course (only Close);
 * `goLabel` replaces "Run course n" (Mark served).
 */
export function GetItemsDialog({
  order,
  course,
  info,
  goLabel,
  onClose,
  onDone,
}: {
  order: Order;
  course: number;
  info: boolean;
  goLabel?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const cfg = useConfig();
  const mine = serverItems(order, course, false, cfg);
  const cook = serverItems(order, course, true, cfg);
  return (
    <Modal
      open
      onClose={onClose}
      width={440}
      title={(info ? 'What to grab for ' : 'Get items for ') + tableName(order)}
      subtitle={`You make these for course ${course}.` + (info ? ' Expo runs the course when it goes out.' : '')}
      footer={
        info ? (
          <Button size="lg" variant="dark" onClick={onClose} block data-autofocus>
            Close
          </Button>
        ) : (
          <>
            <Button size="lg" onClick={onClose} className={s.grow}>
              Not yet
            </Button>
            <Button size="lg" variant="success" onClick={onDone} className={s.grow} data-autofocus>
              {goLabel ?? `Run course ${course}`}
            </Button>
          </>
        )
      }
    >
      <WhoGetsWhat order={order} groups={mine.map((g) => ({ diner: g.diner, lines: g.lines }))} />
      {cook.length > 0 && (
        <div className={s.cook}>
          <div className={s.cookTitle}>From the cook line · ready at Expo</div>
          <WhoGetsWhat order={order} muted groups={cook.map((g) => ({ diner: g.diner, lines: g.lines }))} />
        </div>
      )}
    </Modal>
  );
}
