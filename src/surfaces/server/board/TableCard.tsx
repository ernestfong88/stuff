import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { GlassWater } from 'lucide-react';
import { courseWork } from '../../../domain/courses';
import { leadDiner, tableName } from '../../../domain/orders';
import type { Order } from '../../../domain/types';
import { formatElapsed } from '../../../lib/format';
import { useConfig } from '../../../store/config';
import { useDining } from '../../../store/dining';
import { cx, toast, useNow } from '../../../ui';
import { TriviaButton } from '../features';
import { drinkQueue } from '../shared/lines';
import { checkInWakeMinutes, tableRoom, venueHasExpo } from '../../../domain/venue';
import { cardActions, type CardAction } from './cardActions';
import { DrinksDialog, GetItemsDialog } from './CardDialogs';
import { ReminderRow } from './ReminderRow';
import s from './TableCard.module.css';
import { isLate, minutesBetween, type TableStage } from '../../../domain/tableStage';

export interface OpenCheckOptions {
  /** Open the check on this menu category (e.g. "Desserts"). */
  category?: string;
}

export interface TableCardProps {
  order: Order;
  stage: TableStage;
  /** When the table entered its lane. */
  since: number;
  /** Every diner is on plan with nothing to charge. */
  covered: boolean;
  onOpen: (orderId: string, opts?: OpenCheckOptions) => void;
  /** Printer mode: no lane colour or late flag, the timer runs from when the table sat. */
  plain?: boolean;
}

/** A table on My Tables: name, lead diner, lane timer and the next actions. Tapping it opens the check. */
export function TableCard({ order: o, stage, since, covered, onOpen, plain }: TableCardProps) {
  const cfg = useConfig();
  const dining = useDining();
  const t = useNow();
  const [dialog, setDialog] = useState<'drinks' | 'grab' | null>(null);
  const undo = dining.runUndoFor(o.id);
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => rerender((x) => x + 1), Math.max(0, undo.at + 8000 - t) + 50);
    return () => clearTimeout(id);
  }, [undo, t]);

  const room = tableRoom(o);
  const ms = t - since;
  const late = isLate(o, stage.key, minutesBetween(since, t));
  const lead = leadDiner(o);
  const actions = cardActions(o, {
    stage: stage.key,
    covered,
    hasExpo: venueHasExpo(room),
    checkInWakeMin: checkInWakeMinutes(o.room),
    now: t,
    cfg,
  });
  const grab = actions.find((a): a is Extract<CardAction, { course: number }> => a.kind === 'grab' || a.kind === 'getAndRun');
  const serveCourse = actions.find((a) => a.kind === 'markServed');

  // Nothing to charge, so it closes in one tap; Undo puts the table back.
  const quickClose = () => {
    dining.closeOrder(o.id, {});
    toast(`${tableName(o)} closed on the meal plan`, {
      tone: 'success',
      action: { label: 'Undo', onClick: () => dining.reopenOrder(o.id) },
    });
  };

  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const render = (a: CardAction): ReactNode => {
    switch (a.kind) {
      case 'drinks':
        return (
          <button
            key="drinks"
            className={cx(s.act, s.go)}
            title={(a.upCount ? `${a.upCount} ready at the bar. ` : '') + 'See who gets what, then mark them delivered'}
            onClick={stop(() => setDialog('drinks'))}
          >
            <GlassWater size={15} aria-hidden />
            {a.pour ? 'Get Drinks' : 'Pick up Drinks'}
          </button>
        );
      case 'grab':
        return (
          <button
            key="grab"
            className={cx(s.act, s.nav)}
            title={`What you make for course ${a.course}`}
            onClick={stop(() => setDialog('grab'))}
          >
            What to grab
          </button>
        );
      case 'markServed':
        return (
          <button
            key="served"
            className={cx(s.act, s.go)}
            title={`Nothing in course ${a.course} comes from the cook. Tap once it is on the table`}
            onClick={stop(() => dining.markServed(o.id, a.course))}
          >
            Mark C{a.course} served
          </button>
        );
      case 'readyAtPass':
        return (
          <span key="ready" role="status" className={s.ready} title="Expo runs the course. Go to the pass and take it out.">
            C{a.course} ready
          </span>
        );
      case 'getAndRun':
        return (
          <button
            key="run"
            className={cx(s.act, s.go)}
            title="See what you make for this course, then run it"
            onClick={stop(() => setDialog('grab'))}
          >
            Get items · Run C{a.course}
          </button>
        );
      case 'run':
        return (
          <button key="run" className={cx(s.act, s.go)} onClick={stop(() => dining.runCourse(o.id, a.course))}>
            Run course {a.course}
          </button>
        );
      case 'fire':
        return (
          <button key="fire" className={cx(s.act, s.fire)} onClick={stop(() => a.fireAs.forEach((c) => dining.fireCourseNow(o.id, c)))}>
            {a.label}
          </button>
        );
      case 'dessertOnLine':
        return (
          <span key="dl" className={s.note}>
            Dessert on the line
          </span>
        );
      case 'dessert':
        return (
          <button
            key="dessert"
            className={cx(s.act, s.nav)}
            title="Open the check on the dessert menu"
            onClick={stop(() => onOpen(o.id, { category: 'Desserts' }))}
          >
            Dessert
          </button>
        );
      case 'noDessert':
        return (
          <button
            key="nd"
            className={cx(s.act, s.plain)}
            title="They are finished; move the table to Ready to close"
            onClick={stop(() => dining.noDessert(o.id))}
          >
            No dessert
          </button>
        );
      case 'checkIn':
        return (
          <button
            key="ci"
            className={cx(s.act, a.awake ? s.go : s.sleepy)}
            title={`Tap once you have asked the table how course ${a.course} is`}
            onClick={stop(() => dining.checkIn(o.id, a.course))}
          >
            Check in · C{a.course}
          </button>
        );
      case 'trivia':
        return (
          <span key="trivia" className={s.slot} onClick={(e) => e.stopPropagation()}>
            <TriviaButton order={o} />
          </span>
        );
      case 'quickClose':
        return (
          <button
            key="qc"
            className={cx(s.act, s.close)}
            title="Everyone is on their meal plan with nothing to charge. Closes the check now"
            onClick={stop(() => quickClose())}
          >
            Quick close
          </button>
        );
      case 'confirmPayment':
        return (
          <button key="cp" className={cx(s.act, s.close)} onClick={stop(() => onOpen(o.id))}>
            Confirm payment
          </button>
        );
      case 'takeOrder':
        return (
          <button key="to" className={cx(s.act, s.nav)} onClick={stop(() => onOpen(o.id))}>
            Take the order
          </button>
        );
      case 'finishOrder':
        return (
          <button key="fo" className={cx(s.act, s.nav)} onClick={stop(() => onOpen(o.id))}>
            {a.hasFood ? 'Finish the order' : 'Take food order'}
          </button>
        );
      case 'firedNote':
        return (
          <span key="fired" className={s.note}>
            Fired
          </span>
        );
      case 'atBar':
        return (
          <span key="bar" className={s.atBar} title="The bar is making them">
            <GlassWater size={14} aria-hidden />
            At the bar {a.count}
          </span>
        );
    }
  };

  const runCourse = grab?.course ?? serveCourse?.course ?? null;
  const readyCourse = courseWork(o).run;
  return (
    <div
      className={cx(s.card, plain ? s.plainCard : s[`lane_${stage.key}`], !plain && late && s.late, !plain && stage.key === 'run' && !late && s.loud)}
      onClick={() => onOpen(o.id)}
    >
      <button
        className={s.head}
        aria-label={`Open ${tableName(o)}${lead ? `, ${lead.name}${lead.more ? ` and ${lead.more} more` : ''}` : ''}`}
        onClick={stop(() => onOpen(o.id))}
      >
        <span className={s.table}>{tableName(o)}</span>
        <span className={cx(s.lead, !lead && s.nobody)}>{lead ? lead.name + (lead.more ? ' +' + lead.more : '') : 'No one yet'}</span>
        {!plain && late && stage.key !== 'check' && <span className={s.lateTag}>LATE</span>}
        <span className={cx(s.timer, !plain && late && s.timerLate)}>{formatElapsed(ms)}</span>
      </button>
      {actions.length > 0 && <div className={s.actions}>{actions.map(render)}</div>}
      {undo && (
        <div role="status" className={s.undo} onClick={(e) => e.stopPropagation()}>
          <span className={s.undoText}>✓ C{undo.c} marked served</span>
          <button
            className={cx(s.act, s.plain, s.undoBtn)}
            title={`Put course ${undo.c} back as not served`}
            onClick={stop(() => dining.undoRunCourse(o.id, undo.c, undo))}
          >
            Undo
          </button>
        </div>
      )}
      {readyCourse != null && <ReminderRow order={o} course={readyCourse} />}
      <span className={s.portal} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {dialog === 'drinks' && (
          <DrinksDialog
            order={o}
            queue={drinkQueue(o)}
            onClose={() => setDialog(null)}
            onDone={() => {
              dining.serveDrinks(o.id);
              setDialog(null);
            }}
          />
        )}
        {dialog === 'grab' && runCourse != null && (
          <GetItemsDialog
            order={o}
            course={runCourse}
            info={!serveCourse && grab?.kind === 'grab'}
            goLabel={serveCourse ? `Mark C${runCourse} served` : undefined}
            onClose={() => setDialog(null)}
            onDone={() => {
              if (serveCourse) dining.markServed(o.id, runCourse);
              else dining.runCourse(o.id, runCourse);
              setDialog(null);
            }}
          />
        )}
      </span>
    </div>
  );
}
