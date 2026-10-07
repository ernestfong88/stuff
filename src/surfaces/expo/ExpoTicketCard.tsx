import { Bell, Check, CheckCircle2, Flame, Printer, RotateCw, ShoppingBag, Truck } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { getItem, getTable } from '../../data';
import type { DiningConfig } from '../../domain/config';
import { kitchenItemName } from '../../domain/menu';
import { dinerName, dinerPerson } from '../../domain/orders';
import { serverName } from '../../domain/servers';
import { formatElapsed, formatTime } from '../../lib/format';
import { cx } from '../../ui';
import { DinerPills } from '../kitchen/DinerPills';
import { pickupWindow } from '../kitchen/kitchenTime';
import { orderTextPlan, type TextSettings } from '../kitchen/orderTexts';
import {
  currentCourse,
  expoAction,
  fireableCourse,
  TICKET_STATE_LABEL,
  ticketCourses,
  ticketState,
  type ExpoLine,
  type ExpoTicket,
  type Thresholds,
  type TicketState,
} from './expoTickets';
import s from './ExpoTicketCard.module.css';

export interface ExpoTicketActions {
  fire: (orderId: string, course: number) => void;
  setLine: (orderId: string, lineId: string, state: 'ready' | 'cooking') => void;
  runCourse: (orderId: string, course: number) => void;
  bump: (orderId: string) => void;
  notify: (orderId: string) => void;
  /** Picked up / on its way: the order leaves the pass. */
  handOff: (ticket: ExpoTicket) => void;
  refire: (orderId: string, dinerId: string, lineId: string) => void;
  print: (ticket: ExpoTicket, label: string) => void;
}

export interface ExpoTicketCardProps {
  ticket: ExpoTicket;
  index: number;
  now: number;
  thresholds: Thresholds;
  cfg: DiningConfig;
  texts: TextSettings;
  selected: boolean;
  /** Line highlighted by the bump bar. */
  selectedLineId: string | null;
  actions: ExpoTicketActions;
}

/** "SQ 5", "PU", "DEL" */
export function expoLabel(t: ExpoTicket): string {
  const o = t.order;
  if (o.queueType) return o.queueType === 'delivery' ? 'DEL' : 'PU';
  return (getTable(o.tableId)?.label ?? 'Order') + (o.checkTag ?? '');
}

const stop = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  fn();
};

/** Briefly true after the value changes (not on first render). */
function useChanged<T>(value: T, ms: number): boolean {
  const prev = useRef(value);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setChanged(true);
    const h = setTimeout(() => setChanged(false), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return changed;
}

export function ExpoTicketCard({ ticket: t, index, now, thresholds, cfg, texts, selected, selectedLineId, actions }: ExpoTicketCardProps) {
  const o = t.order;
  const queue = !!o.queueType;
  const [refireOpen, setRefireOpen] = useState(false);
  const [openDone, setOpenDone] = useState<Record<number, boolean>>({});
  const [printed, setPrinted] = useState(false);
  const state = ticketState(t, now, thresholds);
  const changed = useChanged<TicketState>(state, 750);
  const label = expoLabel(t);
  const current = currentCourse(t.lines);
  const fireable = fireableCourse(t);
  const name = (itemId: string) => kitchenItemName(getItem(itemId)?.name ?? '', cfg);
  const lead = o.diners[0] ? dinerPerson(o.diners[0]) : undefined;
  const who = lead
    ? lead.name.split(' ')[0] + ('apt' in lead && lead.apt && !o.assoc && o.diners[0].kind === 'resident' ? ', Apt ' + lead.apt : '')
    : null;
  const allToGo = t.lines.length > 0 && t.lines.every((l) => l.toGo);
  const nothingFired = fireable != null && t.lines.every((l) => l.kitchenState === 'scheduled');

  useEffect(() => {
    if (!printed) return;
    const h = setTimeout(() => setPrinted(false), 1800);
    return () => clearTimeout(h);
  }, [printed]);

  return (
    <article className={cx(s.ticket, s[state], changed && s.changed, selected && s.selected)} aria-label={`${label}, ${TICKET_STATE_LABEL[state]}`}>
      <header className={s.head}>
        <div className={s.headRow}>
          <span className={s.seq} title="Bump bar quick select">
            {index < 10 ? index : ''}
          </span>
          <span className={s.label}>
            {o.queueType === 'delivery' ? <Truck size={17} strokeWidth={2.5} /> : o.queueType === 'pickup' ? <ShoppingBag size={17} strokeWidth={2.5} /> : null}
            {label}
          </span>
          {o.server && o.source !== 'kiosk' && <span className={s.serverPill}>{serverName(o.server)}</span>}
          {o.source === 'kiosk' && (
            <span className={s.kiosk} title="Placed by the resident at the lobby kiosk">
              KIOSK
            </span>
          )}
          {allToGo && <span className={s.togo}>TO GO</span>}
          {!nothingFired && (
            <button
              className={cx(s.refire, refireOpen && s.refireOn)}
              onClick={() => setRefireOpen((v) => !v)}
              aria-expanded={refireOpen}
              aria-label="Refire an item"
              title="Refire an item"
            >
              <RotateCw size={15} strokeWidth={2.75} />
            </button>
          )}
          <span className={cx(s.clock, nothingFired && s.clockPushed)}>{formatElapsed(now - t.firedAt)}</span>
        </div>
        <div className={s.headRow}>
          {o.readyAt && <span className={s.window}>{o.readyAt === 'ASAP' ? 'ASAP' : pickupWindow(o.readyAt)}</span>}
          {who && queue && <span className={s.who}>{who}</span>}
          {o.source === 'kiosk' && <span className={s.serverPill}>{o.utensils ? 'Utensils' : 'No utensils'}</span>}
          <span className={cx(s.state, s[`state_${state}`], changed && s.statePop)}>{TICKET_STATE_LABEL[state]}</span>
        </div>
      </header>

      {refireOpen && (
        <RefirePanel ticket={t} name={name} onClose={() => setRefireOpen(false)} onRefire={(l) => {
            actions.refire(o.id, l.dinerId, l.id);
            setRefireOpen(false);
          }}
        />
      )}

      <div className={s.body}>
        {ticketCourses(t).map(({ course, lines, state: cs }) => {
          const strong = course === current || course === fireable;
          const open = cs !== 'done' || openDone[course];
          return (
            <section key={course} className={cx(s.course, !strong && s.courseQuiet)}>
              {cs === 'done' ? (
                <button
                  className={s.doneHead}
                  aria-expanded={!!openDone[course]}
                  onClick={() => setOpenDone((m) => ({ ...m, [course]: !m[course] }))}
                >
                  <span aria-hidden="true">{openDone[course] ? '▾' : '▸'}</span>
                  <span className={s.doneName}>{queue ? 'ORDER' : 'COURSE ' + course}</span>
                  <span>
                    {lines.length} {lines.length === 1 ? 'item' : 'items'}
                  </span>
                </button>
              ) : (
                !queue && (
                  <div className={s.courseHead}>
                    <span className={s.courseName}>COURSE {course}</span>
                    {fireable === course ? (
                      <button className={s.fireChip} onClick={() => actions.fire(o.id, course)}>
                        <Flame size={12} strokeWidth={2.5} /> Fire
                      </button>
                    ) : (
                      <span className={s.courseChip}>{cs === 'fired' ? 'Fired' : cs === 'ready' ? 'Ready' : 'Holding'}</span>
                    )}
                  </div>
                )
              )}
              {open && <CourseDiners lines={lines} name={name} selectedLineId={selectedLineId} onToggle={(l) => actions.setLine(o.id, l.id, l.kitchenState === 'ready' ? 'cooking' : 'ready')} />}
            </section>
          );
        })}
      </div>

      <footer className={s.foot}>
        <Footer ticket={t} texts={texts} actions={actions} />
        <button
          className={cx(s.print, printed && s.printed)}
          aria-label="Print this course"
          title="Print this course for the runner: each person's name, then their plates. The ticket stays until bumped."
          onClick={() => {
            actions.print(t, label);
            setPrinted(true);
          }}
        >
          {printed ? <Check size={18} strokeWidth={2.5} /> : <Printer size={18} strokeWidth={2.25} />}
        </button>
      </footer>
    </article>
  );
}

function CourseDiners({
  lines,
  name,
  selectedLineId,
  onToggle,
}: {
  lines: ExpoLine[];
  name: (itemId: string) => string;
  selectedLineId: string | null;
  onToggle: (l: ExpoLine) => void;
}) {
  const groups: Array<{ id: string; lines: ExpoLine[] }> = [];
  for (const l of lines) {
    const g = groups.find((x) => x.id === l.dinerId);
    if (g) g.lines.push(l);
    else groups.push({ id: l.dinerId, lines: [l] });
  }
  return (
    <>
      {groups.map((g) => {
        const diner = g.lines[0].diner;
        const allRun = g.lines.every((l) => l.kitchenState === 'cleared');
        return (
          <div key={g.id} className={s.diner}>
            <div className={s.dinerHead}>
              <span className={s.seat}>{diner.seat}</span>
              <span className={cx(s.dinerName, allRun && s.run)}>{dinerName(diner).split(' ')[0]}</span>
              <DinerPills diner={diner} size="sm" />
            </div>
            {g.lines.map((l) => (
              <PlateRow key={l.id} line={l} name={name} highlighted={selectedLineId === l.id} onToggle={() => onToggle(l)} />
            ))}
          </div>
        );
      })}
    </>
  );
}

function PlateRow({ line, name, highlighted, onToggle }: { line: ExpoLine; name: (id: string) => string; highlighted: boolean; onToggle: () => void }) {
  const ready = line.kitchenState === 'ready';
  const run = line.kitchenState === 'cleared';
  const tappable = line.kitchenState === 'cooking' || ready;
  const rush = !!line.rush && line.kitchenState === 'cooking';
  const sides = line.diner.items.filter((x) => x.parentId === line.id && !x.comped && !x.cancelled).map((x) => name(x.itemId));
  const content: ReactNode = (
    <>
      <span className={cx(s.tick, (ready || run) && s.tickOn, run && s.tickRun)} aria-hidden="true">
        {(ready || run) && <Check size={10} strokeWidth={4} />}
      </span>
      <span className={cx(s.plate, run && s.run)}>
        {rush && <span className={s.rush}>REMAKE, RUSH</span>}
        {name(line.itemId)}
        {sides.length > 0 && <span className={s.sides}>+ {sides.join(', ')}</span>}
      </span>
      {line.toGo && <span className={cx(s.togo, s.togoSmall)}>TO GO</span>}
    </>
  );
  const cls = cx(s.plateRow, rush && s.plateRush, highlighted && s.plateOn);
  return tappable ? (
    <button className={cls} onClick={stop(onToggle)} aria-pressed={ready} title={ready ? 'Tap to put back on the line' : 'Tap when the plate is up'}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}

function RefirePanel({
  ticket,
  name,
  onClose,
  onRefire,
}: {
  ticket: ExpoTicket;
  name: (id: string) => string;
  onClose: () => void;
  onRefire: (l: ExpoLine) => void;
}) {
  const queue = !!ticket.order.queueType;
  const lines = ticket.allLines.filter((l) => l.kitchenState !== 'scheduled').sort((a, b) => a.course - b.course);
  return (
    <div className={s.refirePanel}>
      <div className={s.refireHead}>
        <span className={s.refireTitle}>REFIRE WHICH ITEM?</span>
        <button className={s.refireCancel} onClick={onClose}>
          Cancel
        </button>
      </div>
      {lines.map((l) => (
        <button key={l.id} className={s.refireRow} onClick={() => onRefire(l)}>
          <span className={s.refireWho}>
            {queue ? '' : `C${l.course}${l.toGo ? ' to go' : ''} · `}S{l.diner.seat} {dinerName(l.diner).split(' ')[0]}
          </span>
          <span className={s.refireItem}>{name(l.itemId)}</span>
          <RotateCw size={15} strokeWidth={2.75} className={s.refireIcon} />
        </button>
      ))}
    </div>
  );
}

function Footer({ ticket: t, texts, actions }: { ticket: ExpoTicket; texts: TextSettings; actions: ExpoTicketActions }) {
  const o = t.order;
  const queue = !!o.queueType;
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!flash) return;
    const h = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(h);
  }, [flash]);
  const a = expoAction(t);
  switch (a.kind) {
    case 'fire':
      return (
        <button className={cx(s.act, s.actFire)} onClick={() => actions.fire(o.id, a.course)}>
          <Flame size={17} strokeWidth={2.5} />
          {queue ? 'Fire order?' : `Fire course ${a.course}?`}
        </button>
      );
    case 'run':
      return (
        <button className={cx(s.act, s.actGo)} onClick={() => actions.runCourse(o.id, a.course)}>
          <CheckCircle2 size={17} strokeWidth={2.5} />
          Run course {a.course}?
        </button>
      );
    case 'bump':
      return (
        <button className={cx(s.act, s.actNeutral)} onClick={() => actions.bump(o.id)}>
          <CheckCircle2 size={17} strokeWidth={2.5} />
          Bump
        </button>
      );
    case 'handOff': {
      const plan = orderTextPlan(o, texts);
      const firstName = o.assoc && o.assocName ? o.assocName.split(' ')[0] : o.diners[0] ? dinerName(o.diners[0]).split(' ')[0] : 'resident';
      if (a.notified)
        return (
          <button className={cx(s.act, s.actGo, flash && s.actFlash)} onClick={() => actions.handOff(t)}>
            <CheckCircle2 size={17} strokeWidth={2.5} />
            {(plan.sent ? 'Texted ' + (o.notifiedAt ? formatTime(o.notifiedAt) : '') : `Not texted (${plan.why})`) + ', clear?'}
          </button>
        );
      return (
        <>
          {plan.sent && (
            <button
              className={cx(s.act, s.actNeutral, s.actHalf)}
              onClick={() => {
                actions.notify(o.id);
                setFlash(true);
              }}
            >
              <Bell size={15} strokeWidth={2.5} />
              Text {firstName}?
            </button>
          )}
          <button className={cx(s.act, s.actGo, plan.sent && s.actHalf, plan.sent && s.actSplit)} onClick={() => actions.handOff(t)}>
            <CheckCircle2 size={15} strokeWidth={2.5} />
            {o.queueType === 'delivery' ? 'On its way?' : 'Picked up?'}
          </button>
        </>
      );
    }
    case 'ready':
      return (
        <button className={cx(s.act, s.actNeutral)} onClick={() => a.lineIds.forEach((id) => actions.setLine(o.id, id, 'ready'))}>
          <CheckCircle2 size={17} strokeWidth={2.5} />
          {queue ? 'Order ready?' : `Course ${a.course} ready?`}
        </button>
      );
    default:
      return (
        <div className={cx(s.act, s.actIdle)}>
          <Flame size={15} /> Waiting on the line
        </div>
      );
  }
}
