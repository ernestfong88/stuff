import { Check, Pencil, Truck, type LucideIcon } from 'lucide-react';
import { pickupWho } from '../../../domain/pickup';
import { cx } from '../../../ui';
import { dueText, isLate, nextAction, stageView, textedTitle, type QueueAction, type QueueActionKind, type QueueRow } from '../queue/queue';
import { queueTextKey, textMessage, type TextContext } from '../../../domain/pickupService/texts';
import { OrderWho } from './OrderWho';
import s from './QueueRowCard.module.css';

const ACTION_ICON: Record<QueueActionKind, LucideIcon> = {
  finish: Pencil,
  packed: Check,
  onMyWay: Truck,
  pickedUp: Check,
  delivered: Check,
};

export interface QueueRowCardProps {
  row: QueueRow;
  at: number;
  ctx: TextContext;
  leadMinutes: number;
  tracksPickups: boolean;
  onOpen: (orderId: string) => void;
  onAction: (kind: QueueActionKind, row: QueueRow) => void;
}

/**
 * One pick up or delivery: who and what, where it is, when it's due, and the
 * one button it needs next. Tapping anywhere but the button opens the order.
 */
export function QueueRowCard({ row, at, ctx, leadMinutes, tracksPickups, onOpen, onAction }: QueueRowCardProps) {
  const o = row.order;
  const type = o.queueType ?? 'pickup';
  const late = isLate(row, at);
  const stage = stageView(row, at, ctx, leadMinutes);
  const due = dueText(row, at);
  const action: QueueAction | null = nextAction(row, ctx, tracksPickups);
  const who = pickupWho(o);
  const ActionIcon = action ? ACTION_ICON[action.kind] : null;
  const texted = textedTitle(row, ctx, (x) => textMessage(x, queueTextKey(x), ctx));
  return (
    <article className={cx(s.row, late && s.late, (row.stage === 'scheduled' || row.stage === 'draft') && s.quiet)}>
      <button
        className={s.open}
        onClick={() => onOpen(o.id)}
        aria-label={`Open ${who}'s ${type === 'delivery' ? 'delivery' : 'pick up'} order`}
        title={[`${stage.label}: ${stage.detail}`, texted].filter(Boolean).join('\n')}
      />
      <OrderWho order={o} mobile={ctx.mobile} />
      <div className={cx(s.stage, s[`tone_${stage.tone}`])}>
        <span className={s.dot} aria-hidden />
        {stage.label}
      </div>
      <div className={cx(s.due, s[`due_${due.tone}`])}>{due.text}</div>
      <div className={s.action}>
        {action && ActionIcon && (
          <button className={cx(s.actionBtn, s[`act_${action.kind}`])} onClick={() => onAction(action.kind, row)}>
            <ActionIcon size={15} strokeWidth={2.5} aria-hidden />
            {action.label}
          </button>
        )}
      </div>
    </article>
  );
}
