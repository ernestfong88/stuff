import { Check, ChevronRight, Pencil, Truck, type LucideIcon } from 'lucide-react';
import { PICKUP_STAGE_STEP, pickupWho, type PickupStage } from '../../../domain/pickup';
import { dinerPerson } from '../../../domain/orders';
import { Avatar, cx } from '../../../ui';
import {
  dueText,
  isLate,
  nextAction,
  stageView,
  textedTitle,
  type QueueAction,
  type QueueActionKind,
  type QueueRow,
} from '../queue/queue';
import { queueTextKey, textMessage, type TextContext } from '../../../domain/pickupService/texts';
import { OrderWho } from './OrderWho';
import { QueueTypeIcon } from './QueueTypeIcon';
import s from './QueueRowCard.module.css';

const ACTION_ICON: Record<QueueActionKind, LucideIcon> = {
  finish: Pencil,
  packed: Check,
  onMyWay: Truck,
  pickedUp: Check,
  delivered: Check,
};

/** Four-step progress: in the kitchen, ready, handed on, done. */
export function StageSteps({ stage }: { stage: PickupStage }) {
  const step = PICKUP_STAGE_STEP[stage];
  const handedOn = stage === 'out' || stage === 'waiting';
  return (
    <span className={s.steps} aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={cx(s.step, i <= step && (handedOn ? s.stepAmber : s.stepOn))} />
      ))}
    </span>
  );
}

export interface QueueRowCardProps {
  row: QueueRow;
  at: number;
  ctx: TextContext;
  leadMinutes: number;
  tracksPickups: boolean;
  onOpen: (orderId: string) => void;
  onAction: (kind: QueueActionKind, row: QueueRow) => void;
}

/** One pick up or delivery on the list. Tapping anywhere but the button opens the order. */
export function QueueRowCard({ row, at, ctx, leadMinutes, tracksPickups, onOpen, onAction }: QueueRowCardProps) {
  const o = row.order;
  const type = o.queueType ?? 'pickup';
  const late = isLate(row, at);
  const stage = stageView(row, at, ctx, leadMinutes);
  const due = dueText(row, at);
  const action: QueueAction | null = nextAction(row, ctx, tracksPickups);
  const person = o.diners[0] ? dinerPerson(o.diners[0]) : undefined;
  const who = pickupWho(o);
  const ActionIcon = action ? ACTION_ICON[action.kind] : null;
  return (
    <article className={cx(s.row, late && s.late, (row.stage === 'scheduled' || row.stage === 'draft') && s.quiet)}>
      <button
        className={s.open}
        onClick={() => onOpen(o.id)}
        aria-label={`Open ${who}'s ${type === 'delivery' ? 'delivery' : 'pick up'} order`}
        title={textedTitle(row, ctx, (x) => textMessage(x, queueTextKey(x), ctx))}
      />
      <QueueTypeIcon type={type} />
      {person && <Avatar person={person} size={38} />}
      <OrderWho order={o} mobile={ctx.mobile} />
      <div className={s.stage}>
        <div className={cx(s.stageLabel, s[`tone_${stage.tone}`])}>{stage.label}</div>
        <div className={s.stageDetail}>{stage.detail}</div>
        <StageSteps stage={row.stage} />
      </div>
      <div className={cx(s.due, s[`due_${due.tone}`])}>{due.text}</div>
      <div className={s.action}>
        {action && ActionIcon && (
          <button className={cx(s.actionBtn, s[`act_${action.kind}`])} onClick={() => onAction(action.kind, row)}>
            <ActionIcon size={14} strokeWidth={2.5} aria-hidden />
            {action.label}
          </button>
        )}
      </div>
      <ChevronRight className={s.chev} size={18} aria-hidden />
    </article>
  );
}
