import { AlertTriangle, Trash2, UserPlus } from 'lucide-react';
import { dinerBilling } from '../../../../domain/billing';
import { isDrink } from '../../../../domain/menu';
import { dinerName, dinerPerson } from '../../../../domain/orders';
import { dinerPills } from '../../../../domain/residents';
import { initials } from '../../../../lib/format';
import type { Associate, Diner, Order, OrderLine, Resident } from '../../../../domain/types';
import { useConfig } from '../../../../store/config';
import { useDining } from '../../../../store/dining';
import { Avatar, Chip, cx } from '../../../../ui';
import { sortWithSides } from '../checkLines';
import s from './DinerCard.module.css';
import { LineRow } from './LineRow';
import { SeatPicker } from './SeatPicker';
import { UsualsRow } from './UsualsRow';
import type { Usual } from './usuals';

/** A guest is not the host, so they get initials rather than the host's photo. */
export function dinerFace(d: Diner, person: Resident | Associate | undefined) {
  return d.isGuest ? { name: dinerName(d), photo: initials(dinerName(d)) || 'G' } : person;
}

/**
 * One person at the table: seat, who they are, their usuals until they
 * order, and their lines. When everything they ordered is out they can be
 * closed on their own while the seat stays open.
 */
export function DinerCard({
  order: o,
  diner,
  selected,
  round,
  usualsOn,
  onSelect,
  onAddGuest,
  onRemove,
  onEditLine,
  onAddUsual,
  onCloseDiner,
}: {
  order: Order;
  diner: Diner;
  selected: boolean;
  /** The table is round (seat picker shows the circle). */
  round: boolean;
  usualsOn: boolean;
  onSelect: () => void;
  onAddGuest: (host: Resident) => void;
  onRemove: () => void;
  onEditLine: (line: OrderLine) => void;
  onAddUsual: (u: Usual) => void;
  /** Close this diner on their own: on plan straight away, or confirm payment. */
  onCloseDiner: (onPlan: boolean) => void;
}) {
  const cfg = useConfig();
  const { editSeat } = useDining();
  const person = dinerPerson(diner);
  const resident = diner.kind === 'resident' ? (person as Resident | undefined) : undefined;
  const isResident = diner.kind === 'resident' && !diner.isGuest;
  const first = person?.name.split(' ')[0] ?? '';
  const pills = dinerPills(diner);
  const hasFood = diner.items.some((l) => !l.cancelled && !isDrink(l.itemId));
  const allOut = diner.items.length > 0 && diner.items.every((i) => i.sent && (i.kitchenState === 'cleared' || i.kitchenState === 'ready'));
  const onPlan = isResident && dinerBilling(diner, o, cfg).outOfPlan === 0;

  return (
    <article
      className={cx(s.card, 'fade-in', selected && s.selected)}
      onPointerDownCapture={() => !selected && onSelect()}
      aria-label={dinerName(diner)}
    >
      <div className={s.head} onClick={onSelect}>
        <SeatPicker order={o} diner={diner} round={round} onPick={(seat) => editSeat(o.id, diner.id, seat)} />
        <span className={s.face}>
          <Avatar person={dinerFace(diner, person)} size={44} />
          {diner.isGuest && <span className={s.guestTag}>GUEST</span>}
        </span>
        <div className={s.who}>
          <div className={s.name}>{dinerName(diner)}</div>
          <div className={s.meta}>
            {isResident && resident?.apt && (
              <span className={s.apt}>
                Apt {resident.apt}
                {resident.level ? ' · ' + resident.level : ''}
              </span>
            )}
            {!isResident && (
              <span className={s.kind}>{diner.kind === 'resident' ? 'Guest' : `${(person as Associate | undefined)?.dept ?? ''} · associate`}</span>
            )}
            {pills.map((p) => (
              <Chip key={p.kind + p.text} size="xs" tone={p.kind === 'allergy' ? 'danger' : 'gold'} icon={p.kind === 'allergy' ? <AlertTriangle size={9} strokeWidth={2.5} /> : undefined}>
                {p.text}
              </Chip>
            ))}
          </div>
        </div>
        {isResident && resident && (
          <button
            className={cx(s.iconBtn, s.addGuest)}
            title={`Add a guest for ${first}`}
            aria-label={`Add a guest for ${first}`}
            onClick={(e) => {
              e.stopPropagation();
              onAddGuest(resident);
            }}
          >
            <UserPlus size={15} aria-hidden />
          </button>
        )}
        <button
          className={s.iconBtn}
          title={`Remove ${dinerName(diner)} from the check`}
          aria-label={`Remove ${dinerName(diner)} from the check`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 size={15} aria-hidden />
        </button>
      </div>
      {usualsOn && isResident && resident && !hasFood && (
        <UsualsRow diner={diner} resident={resident} meal={o.meal} onAdd={onAddUsual} />
      )}
      {diner.items.length > 0 && (
        <div className={s.lines}>
          {sortWithSides(diner.items).map((line) => (
            <LineRow key={line.id} order={o} diner={diner} line={line} person={resident} onEdit={() => onEditLine(line)} />
          ))}
        </div>
      )}
      {allOut && (
        <button
          className={cx(s.closeBar, onPlan ? s.closePlan : s.closeCharge)}
          onClick={(e) => {
            e.stopPropagation();
            onCloseDiner(onPlan);
          }}
        >
          Close {first} · {onPlan ? 'on plan · seat stays open' : 'has charges · confirm payment'}
        </button>
      )}
    </article>
  );
}
