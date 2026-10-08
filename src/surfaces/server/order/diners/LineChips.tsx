import { Check, CircleCheck, Flame, GlassWater, Pause, Send } from 'lucide-react';
import type { KitchenState, OrderLine } from '../../../../domain/types';
import { printerMode } from '../../../../domain/config';
import { useConfig } from '../../../../store/config';
import { minutesSince } from '../../../../lib/clock';
import { cx } from '../../../../ui';
import { AnchoredMenu } from '../../shared/AnchoredMenu';
import s from './LineChips.module.css';

export type CourseChoice = 1 | 2 | 3 | 4 | 'togo';

/** The course chip on a line: set its course before it is sent, or box it to go any time. */
export function CoursePick({
  course,
  toGo,
  editable,
  onPick,
}: {
  course: number;
  toGo: boolean;
  editable: boolean;
  onPick: (c: CourseChoice) => void;
}) {
  const row = (v: CourseChoice, label: string, on: boolean, disabled: boolean, close: () => void) => (
    <button
      key={String(v)}
      role="menuitemradio"
      aria-checked={on}
      disabled={disabled}
      className={cx(s.option, on && s.optionOn)}
      onClick={() => {
        close();
        onPick(v);
      }}
    >
      <span className={s.optionLabel}>{label}</span>
      {on && <Check size={14} strokeWidth={2.5} aria-hidden />}
    </button>
  );
  return (
    <AnchoredMenu
      label="Course"
      width={180}
      height={250}
      trigger={({ open, toggle }) => (
        <button
          className={cx(s.course, editable ? s.courseEdit : s.courseSent, open && s.courseOpen)}
          title={editable ? 'Tap to set the course or box it to go' : 'Sent. Tap to box it to go'}
          aria-label={`Course ${course}${toGo ? ', to go' : ''}. Change`}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
        >
          C{course}
        </button>
      )}
    >
      {({ close }) => (
        <>
          {([1, 2, 3, 4] as const).map((c) => row(c, `Course ${c}`, course === c && !toGo, !editable, close))}
          <div className={s.divider} />
          {row('togo', 'To Go', toGo, false, close)}
        </>
      )}
    </AnchoredMenu>
  );
}

/** Drinks never take a course: their chip shows where the drink is, and gets tapped once it is on the table. */
const DRINK_STATES: Record<'new' | 'pour' | 'bar' | 'up' | 'cleared', [string, string]> = {
  new: ['New drink', 'Drinks never take a course. Sending rings it in.'],
  pour: ['Yours to get', 'Tap once it is on the table.'],
  bar: ['At the bar', 'The bar is making it.'],
  up: ['Up at the bar', 'Ready at the bar. Tap once it is on the table.'],
  cleared: ['On the table', 'Delivered.'],
};

/** A drink's state as a coloured glass; the ones to fetch (yours to get, up at the bar) are outlined buttons. */
export function DrinkChip({ line, onDelivered }: { line: OrderLine; onDelivered: () => void }) {
  const k = !line.sent
    ? 'new'
    : line.kitchenState === 'pour' || line.kitchenState === 'bar' || line.kitchenState === 'up'
      ? line.kitchenState
      : 'cleared';
  const [label, title] = DRINK_STATES[k];
  const go = k === 'pour' || k === 'up';
  return (
    <button
      className={cx(s.drink, s[`drink_${k}`], go && s.drinkGo)}
      title={`${label}. ${title}`}
      aria-label={`${label}. ${title}`}
      disabled={!go}
      onClick={(e) => {
        e.stopPropagation();
        if (go) onDelivered();
      }}
    >
      {k === 'cleared' ? <Check size={15} strokeWidth={3} aria-hidden /> : <GlassWater size={15} aria-hidden />}
    </button>
  );
}

const STATE_ICONS: Partial<Record<NonNullable<KitchenState>, { label: string; cls: string; icon: typeof Send }>> = {
  cooking: { label: 'Cooking', cls: 'cooking', icon: Flame },
  ready: { label: 'Ready at the pass', cls: 'ready', icon: CircleCheck },
  cleared: { label: 'Served', cls: 'served', icon: Check },
};

/** Where a line is, as an icon: new (dot), held (pause and minutes), sent, cooking, ready or served. The word is its tooltip. */
export function LineState({ line }: { line: OrderLine }) {
  const printers = printerMode(useConfig());
  if (!line.sent) {
    if (line.hold) {
      const label = `Held ${minutesSince(line.holdAt)} min`;
      return (
        <span className={cx(s.stateIcon, s.held, s.withText)} title={label} aria-label={label} role="img">
          <Pause size={12} strokeWidth={2.5} aria-hidden />
          {minutesSince(line.holdAt)}m
        </span>
      );
    }
    return <span className={s.newDot} title="New, not sent yet" aria-label="New, not sent yet" role="img" />;
  }
  // Printers track nothing after the send, so a sent line just shows Sent.
  const p = (!printers && line.kitchenState && STATE_ICONS[line.kitchenState]) || { label: 'Sent', cls: 'sent', icon: Send };
  const Icon = p.icon;
  return (
    <span className={cx(s.stateIcon, s[p.cls])} title={p.label} aria-label={p.label} role="img">
      <Icon size={13} strokeWidth={2.5} aria-hidden />
    </span>
  );
}

/** Small uppercase tags after a line name: Comped, Remake, Cancelled, To Go. */
export function LineTags({ line }: { line: OrderLine }) {
  return (
    <>
      {line.comped && <span className={cx(s.tag, s.tagComped)}>Comped</span>}
      {line.rush && !line.comped && <span className={cx(s.tag, s.tagRush)}>Remake · rushed</span>}
      {line.cancelled && (
        <span className={cx(s.tag, s.tagCancelled)} title="Cancelled after the kitchen started it, so it still counts.">
          Cancelled
        </span>
      )}
      {line.toGo && (
        <span className={cx(s.tag, s.tagToGo)} title="Boxed to go. Change it from the course chip.">
          To Go
        </span>
      )}
    </>
  );
}
