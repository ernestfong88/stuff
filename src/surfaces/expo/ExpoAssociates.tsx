import { Check, CheckCircle2, Flame } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AssocMeal } from '../../domain/types';
import { now as clockNow } from '../../lib/clock';
import { formatElapsed } from '../../lib/format';
import { cx } from '../../ui';
import { GridMessage, TicketGrid, TicketSlot } from '../kitchen/KitchenShell';
import { pickupWindow } from '../kitchen/kitchenTime';
import { assocNext, assocState, dishTitle, NOC_CLOSE, shortSpan, type AssocStage, type AssocTicket } from './assocTickets';
import s from './ExpoTicketCard.module.css';
import { TICKET_STATE_LABEL } from './expoTickets';

/** Associates: today's associate meals, one card each, in window order. Meals never fired for a past window are listed as missed. */
export function ExpoAssociates({
  tickets,
  missed = [],
  now,
  onUpdate,
}: {
  tickets: AssocTicket[];
  missed?: AssocTicket[];
  now: number;
  onUpdate: (id: string, patch: AssocStage & Partial<AssocMeal>, text: string) => void;
}) {
  return (
    <TicketGrid>
      {tickets.map((t, i) => (
        <TicketSlot key={t.meal.id} index={i}>
          <AssocTicketCard ticket={t} index={i} now={now} onUpdate={onUpdate} />
        </TicketSlot>
      ))}
      {tickets.length === 0 && <GridMessage title="No associate orders left today." />}
      {missed.length > 0 && (
        <GridMessage title={`Missed earlier today: ${missed.length}`}>
          Never fired, and their pick up time has passed: {missed.map((t) => `${t.meal.associate} (${pickupWindow(t.meal.window)})`).join(', ')}.
        </GridMessage>
      )}
    </TicketGrid>
  );
}

function AssocTicketCard({ ticket: t, index, now, onUpdate }: { ticket: AssocTicket; index: number; now: number; onUpdate: (id: string, patch: AssocStage & Partial<AssocMeal>, text: string) => void }) {
  const m = t.meal;
  const state = assocState(t, now);
  const prev = useRef(state);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (prev.current === state) return;
    prev.current = state;
    setChanged(true);
    const h = setTimeout(() => setChanged(false), 750);
    return () => clearTimeout(h);
  }, [state]);

  const next = assocNext(m);
  const timer =
    next.kind === 'fire' ? (now > t.at ? shortSpan(now - t.at) + ' over' : 'in ' + shortSpan(t.at - now)) : formatElapsed(now - (next.kind === 'ready' ? m.firedAt ?? now : m.readyAt ?? now));
  const courseChip = state === 'late' ? (next.kind === 'fire' ? 'Holding' : 'Ready') : TICKET_STATE_LABEL[state];
  const detail = [m.note ? '“' + m.note + '”' : '', t.noc ? `Set out before the ${NOC_CLOSE} close` : ''].filter(Boolean).join(', ');

  return (
    <article className={cx(s.ticket, s[state], changed && s.changed)} aria-label={`Associate meal for ${m.associate}, ${TICKET_STATE_LABEL[state]}`}>
      <header className={s.head}>
        <div className={s.headRow}>
          {index < 10 && <span className={s.seq}>{index}</span>}
          <span className={cx(s.label, s.assocName)}>{m.associate}</span>
          <span className={cx(s.clock, s.clockPushed)}>{timer}</span>
        </div>
        <div className={s.headRow}>
          <span className={s.window}>{(t.noc ? 'NOC ' : '') + pickupWindow(m.window)}</span>
          <span className={s.serverPill}>Associate</span>
          <span className={cx(s.state, s[`state_${state}`], changed && s.statePop)}>{TICKET_STATE_LABEL[state]}</span>
        </div>
      </header>
      <div className={s.body}>
        <section className={s.course}>
          <div className={s.courseHead}>
            <span className={s.courseName}>{t.noc ? 'OVERNIGHT' : String(m.meal).toUpperCase()}</span>
            <span className={s.courseChip}>{courseChip}</span>
          </div>
          <div className={s.diner}>
            <div className={s.plateRow}>
              <span className={cx(s.tick, m.readyAt != null && s.tickOn)} aria-hidden="true">
                {m.readyAt != null && <Check size={10} strokeWidth={4} />}
              </span>
              <span className={s.plate}>
                {dishTitle(m.item)}
                {detail && <span className={s.sides}>{detail}</span>}
              </span>
            </div>
          </div>
        </section>
      </div>
      <footer className={s.foot}>
        {next.kind === 'fire' ? (
          <button className={cx(s.act, s.actFire)} onClick={() => onUpdate(m.id, { firedAt: clockNow() }, 'Fired at Expo')}>
            <Flame size={17} strokeWidth={2.5} /> Fire order?
          </button>
        ) : next.kind === 'ready' ? (
          <button className={cx(s.act, s.actNeutral)} onClick={() => onUpdate(m.id, { readyAt: clockNow() }, 'Marked ready at Expo')}>
            <CheckCircle2 size={17} strokeWidth={2.5} /> Order ready?
          </button>
        ) : (
          <button className={cx(s.act, s.actGo)} onClick={() => onUpdate(m.id, { status: 'Picked up', pickedAt: clockNow() }, 'Picked up at Expo')}>
            <CheckCircle2 size={17} strokeWidth={2.5} /> Picked up?
          </button>
        )}
      </footer>
    </article>
  );
}
