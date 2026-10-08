import { useState } from 'react';
import { Check, User } from 'lucide-react';
import { checkPin } from '../../shell/session';
import { CLEANING_WHEN, WEEKDAYS, isoOf, weeklyDueDate, type CleaningStatus, type CleaningTask } from '../../domain/cleaning';
import { formatTime } from '../../lib/format';
import { crewMember, signCleaning, unsignCleaning, useCleaning } from '../../store/cleaning';
import { Button, Modal, cx, toast, useConfirm } from '../../ui';
import { PinPad } from '../server/shared/ManagerPin';
import { cleaningToday, dayLabel, type CleaningRow } from './logic';
import k from '../kitchen/KitchenShell.module.css';
import s from './CleaningLog.module.css';

type Row = CleaningRow;

const STATUS_LABEL: Partial<Record<CleaningStatus, string>> = { due: 'Due today', overdue: 'Overdue' };

/**
 * The kitchen's cleaning log on the prep tablet. A cook taps a task and signs
 * it off with their PIN, so the log says who did it and when, even when it
 * was assigned to someone else.
 */
export function CleaningLog({ venueId, nowMs }: { venueId: string; nowMs: number }) {
  const state = useCleaning();
  const [signing, setSigning] = useState<CleaningTask | null>(null);
  const [ask, dialog] = useConfirm();
  const { iso, rows } = cleaningToday(state, venueId, nowMs);
  const base = new Date(nowMs);
  const daily = CLEANING_WHEN.map(([when, label]) => ({
    id: when,
    label,
    rows: rows.filter((r) => r.task.freq === 'daily' && r.task.when === when),
  })).filter((g) => g.rows.length);
  const weekly = rows.filter((r) => r.task.freq === 'weekly');
  const weekStart = -base.getDay();

  const unsign = async (r: Row) => {
    const ok = await ask({
      title: `Un-sign ${r.task.text}?`,
      message: `${r.sign!.by}'s sign-off at ${formatTime(r.sign!.at)} is removed and the task is open again.`,
      confirmLabel: 'Un-sign',
      tone: 'danger',
      className: k.dialog,
    });
    if (ok) unsignCleaning(venueId, r.task, iso);
  };

  const list = (items: Row[]) => (
    <div className={s.items}>
      {items.map((r) => (
        <TaskRow key={r.task.id} row={r} todayIso={iso} onSign={() => setSigning(r.task)} onUndo={() => unsign(r)} />
      ))}
    </div>
  );

  return (
    <>
      <div className={s.head}>
        <h2 className={s.capToday}>Today · {dayLabel(base, 0)}</h2>
      </div>
      {daily.length ? (
        <div className={s.grid}>
          {daily.map((g) => (
            <section key={g.id} aria-label={g.label} className={s.group}>
              <header className={s.groupHead}>
                <h3 className={s.name}>{g.label}</h3>
                <Count rows={g.rows} />
              </header>
              {list(g.rows)}
            </section>
          ))}
        </div>
      ) : (
        <p className={s.empty}>No daily cleaning set up. Back Office sets it up under Cleaning Log.</p>
      )}

      <div className={s.head}>
        <h2 className={s.capWeek}>
          This week · {dayLabel(base, weekStart)} to {dayLabel(base, weekStart + 6)}
        </h2>
      </div>
      {weekly.length ? (
        <section aria-label="This week" className={cx(s.group, s.weekGroup)}>
          <header className={s.groupHead}>
            <h3 className={s.name}>Weekly</h3>
            <Count rows={weekly} />
          </header>
          {list(weekly)}
        </section>
      ) : (
        <p className={s.empty}>No weekly cleaning set up.</p>
      )}

      {signing && (
        <Modal
          open
          onClose={() => setSigning(null)}
          width={380}
          title={`Sign off: ${signing.text}`}
          subtitle="Enter your PIN"
          className={k.dialog}
        >
          <PinPad
            accept={(pin) => !!checkPin(pin)}
            onOk={(pin) => {
              const who = checkPin(pin);
              if (!who) return;
              signCleaning(venueId, signing, iso, who.id, who.name);
              setSigning(null);
              toast(`${signing.text}: signed off by ${who.name}`, { tone: 'success' });
            }}
          />
          <Button variant="ghost" block onClick={() => setSigning(null)} className={s.cancel}>
            Cancel
          </Button>
        </Modal>
      )}
      {dialog}
    </>
  );
}

function Count({ rows }: { rows: Row[] }) {
  const done = rows.filter((r) => r.sign).length;
  return (
    <span className={cx(s.count, done === rows.length && s.countDone)}>
      {done} of {rows.length}
    </span>
  );
}

function TaskRow({ row, todayIso, onSign, onUndo }: { row: Row; todayIso: string; onSign: () => void; onUndo: () => void }) {
  const { task, sign, status } = row;
  const assignee = crewMember(task.assignee)?.short ?? (task.assignee || 'Anyone on shift');
  const due = task.freq === 'weekly' ? weeklyDueDate(task, todayIso) : null;
  const dueDay = WEEKDAYS[task.day].slice(0, 3);
  const pill = due && status === 'overdue' ? `Overdue · due ${dueDay}` : (STATUS_LABEL[status] ?? (due && !sign ? `Due ${dueDay}` : null));
  // A weekly task signed another day says which day.
  const signedDay = sign && isoOf(new Date(sign.at)) !== todayIso ? new Date(sign.at).toLocaleDateString('en-US', { weekday: 'short' }) + ' ' : '';

  const body = (
    <>
      <span className={cx(s.box, sign && s.boxOn)} aria-hidden>
        {sign && <Check size={16} strokeWidth={3} />}
      </span>
      <span className={s.text}>
        <span className={s.label}>{task.text}</span>
        <span className={s.meta}>
          <span className={s.who}>
            <User size={12} aria-hidden /> {assignee}
          </span>
          {sign && (
            <span className={s.stamp}>
              ✓ {sign.by} · {signedDay}
              {formatTime(sign.at)}
            </span>
          )}
        </span>
      </span>
      {pill && <span className={cx(s.pill, status === 'overdue' && s.pillLate, status === 'due' && s.pillDue)}>{pill}</span>}
    </>
  );

  if (sign) {
    return (
      <div className={cx(s.row, s.rowDone)}>
        {body}
        <button className={s.undo} onClick={onUndo} aria-label={`Un-sign ${task.text}`}>
          Undo
        </button>
      </div>
    );
  }
  return (
    <button
      className={cx(s.row, s.tap, status === 'overdue' && s.rowLate, status === 'due' && s.rowDue)}
      onClick={onSign}
      aria-label={`Sign off ${task.text}`}
    >
      {body}
    </button>
  );
}
