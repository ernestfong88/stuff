import { CircleCheck, DollarSign, Send } from 'lucide-react';
import { closeIsNext } from '../../../domain/courses';
import { hasUnsent, heldCount } from '../../../domain/orders';
import { clockLabel, pickupFireAt, pickupLeadMinutes } from '../../../domain/pickup';
import type { Order } from '../../../domain/types';
import { now } from '../../../lib/clock';
import { useConfig } from '../../../store/config';
import { useDining } from '../../../store/dining';
import { cx } from '../../../ui';
import { MicButton } from '../features';
import { sendableLines, sendLabel, sentMessage } from './checkLines';
import { rangeLabel } from './queue/pickupWindows';
import s from './SendBar.module.css';

/** The check's footer: Close & charge, and Send (which says what it will do). */
export function SendBar({
  order: o,
  justSent,
  printNote,
  onSend,
  onClose,
}: {
  order: Order;
  justSent: boolean;
  /** Printer mode: where the tickets printed. */
  printNote?: string;
  onSend: () => void;
  onClose: () => void;
}) {
  const cfg = useConfig();
  const { orders, history, kitchenMode } = useDining();
  const unsent = hasUnsent(o);
  const held = heldCount(o);
  const noDiners = o.diners.length === 0;
  const closeFirst = !unsent && !noDiners && closeIsNext(o, cfg);

  if (justSent) {
    return (
      <footer className={s.bar}>
        <div className={s.sent} role="status">
          <CircleCheck size={18} aria-hidden /> {kitchenMode === 'printers' ? (printNote ?? 'Tickets printed') : sentMessage(o)}
        </div>
      </footer>
    );
  }

  const label = (() => {
    if (!unsent) return held ? `${held} held. Release to send` : 'Nothing new to send';
    const fireAt = pickupFireAt(o, pickupLeadMinutes([...orders, ...history], cfg));
    if (fireAt && fireAt > now()) return `Schedule for ${rangeLabel(o.readyAt)} · kitchen fires at ${clockLabel(fireAt)}`;
    if (o.queueType) return 'Send to kitchen · ASAP, whole order fires now';
    return sendLabel(o, sendableLines(o), held, cfg);
  })();

  return (
    <footer className={s.bar}>
      <button className={cx(s.close, closeFirst && s.closeFirst)} disabled={noDiners} onClick={onClose}>
        <DollarSign size={15} aria-hidden /> Close &amp; charge
      </button>
      <button className={cx(s.send, unsent && s.sendOn)} disabled={!unsent} onClick={onSend}>
        <Send size={16} aria-hidden /> <span className={s.sendLabel}>{label}</span>
      </button>
      <span className={s.voice}>
        <MicButton order={o} />
      </span>
    </footer>
  );
}
