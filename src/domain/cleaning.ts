/**
 * Cleaning log: the kitchen's daily and weekly cleaning, kept apart from the
 * prep checklist so each task is signed off by the cook who did it.
 *
 * A daily task is due every day at Opening, Mid-day or Closing. A weekly task
 * is due on one day of the week (weeks run Sunday to Saturday) and can be
 * signed off any day that week. Dates are "YYYY-MM-DD" in local time; a sign
 * off is kept per period: the day for a daily task, the week's Sunday for a
 * weekly one.
 */

export type CleaningWhen = 'open' | 'mid' | 'close';
export type CleaningFreq = 'daily' | 'weekly';

export const CLEANING_WHEN: ReadonlyArray<[CleaningWhen, string]> = [
  ['open', 'Opening'],
  ['mid', 'Mid-day'],
  ['close', 'Closing'],
];

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** A daily task left undone after this time (minutes after midnight) is overdue. */
export const DUE_BY: Record<CleaningWhen, number> = { open: 10 * 60, mid: 15 * 60, close: 21 * 60 };

export interface CleaningTask {
  id: string;
  text: string;
  freq: CleaningFreq;
  /** When in the day a daily task is done. */
  when: CleaningWhen;
  /** The day a weekly task is due, 0 Sunday to 6 Saturday. */
  day: number;
  /** Staff id of the person it is assigned to; null is anyone on shift. */
  assignee: string | null;
}

/** Who signed a task off with their PIN, and when. */
export interface CleaningSignOff {
  staffId: string;
  /** "T. Reyes", as the kitchen signs its work. */
  by: string;
  at: number;
}

/**
 * Where a task stands: done; open (today, still in time); due (a weekly task
 * due today); upcoming (later); overdue (past its time, still fixable); missed
 * (its day or week is over).
 */
export type CleaningStatus = 'done' | 'open' | 'due' | 'upcoming' | 'overdue' | 'missed';

export function whenLabel(when: CleaningWhen): string {
  return CLEANING_WHEN.find((w) => w[0] === when)?.[1] ?? when;
}

/** "Adriana Alvarado" → "A. Alvarado". */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

// ─── Dates ───────────────────────────────────────────────────────────────

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Midnight of a "YYYY-MM-DD" date, local time. */
export function dateOf(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = dateOf(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

/** The Sunday that starts the week of a date. */
export function weekOf(iso: string): string {
  return addDays(iso, -dateOf(iso).getDay());
}

/** The seven dates of the week starting on a Sunday. */
export function weekDates(weekIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekIso, i));
}

/** The date a weekly task falls due in the week of `iso`. */
export function weeklyDueDate(task: Pick<CleaningTask, 'day'>, iso: string): string {
  return addDays(weekOf(iso), task.day);
}

/** The period a sign-off is kept under: the day for a daily task, the week's Sunday for a weekly one. */
export function periodOf(task: Pick<CleaningTask, 'freq'>, iso: string): string {
  return task.freq === 'weekly' ? weekOf(iso) : iso;
}

// ─── What is due ─────────────────────────────────────────────────────────

/** The tasks due on a date: every daily task, and the weekly ones due that weekday. */
export function tasksDueOn<T extends CleaningTask>(tasks: T[], iso: string): T[] {
  const dow = dateOf(iso).getDay();
  return tasks.filter((t) => t.freq === 'daily' || t.day === dow);
}

/**
 * A task's status on a date (for a weekly task, any date in its week) at
 * `nowMs`. A daily task today is overdue once its Opening, Mid-day or Closing
 * time has passed; a weekly task is overdue after its day and missed once the
 * week is over.
 */
export function cleaningStatus(task: CleaningTask, iso: string, sign: CleaningSignOff | null, nowMs: number): CleaningStatus {
  if (sign) return 'done';
  const now = new Date(nowMs);
  const todayIso = isoOf(now);
  if (task.freq === 'daily') {
    if (iso < todayIso) return 'missed';
    if (iso > todayIso) return 'upcoming';
    return now.getHours() * 60 + now.getMinutes() >= DUE_BY[task.when] ? 'overdue' : 'open';
  }
  const week = weekOf(iso);
  if (addDays(week, 6) < todayIso) return 'missed';
  if (week > todayIso) return 'upcoming';
  const due = weeklyDueDate(task, iso);
  return due === todayIso ? 'due' : due < todayIso ? 'overdue' : 'upcoming';
}

/** Daily tasks Opening first, then weekly tasks by the day they are due; otherwise in list order. */
export function sortForShift<T extends CleaningTask>(tasks: T[]): T[] {
  const rank = (t: T) => (t.freq === 'daily' ? CLEANING_WHEN.findIndex((w) => w[0] === t.when) : 10 + t.day);
  return tasks
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i)
    .map((x) => x.t);
}

export interface LogCell {
  task: CleaningTask;
  /** The date the cell stands for (a weekly task's due date). */
  iso: string;
  status: CleaningStatus;
  sign: CleaningSignOff | null;
}

export interface WeekLogRow {
  task: CleaningTask;
  /** Sunday to Saturday; null on the days a weekly task isn't due. */
  cells: Array<LogCell | null>;
}

/**
 * A week of the log, task by task: a daily task has a cell for each of the
 * seven days; a weekly task has one, on its due date. `signOf` reads the
 * sign-off for a task on a date.
 */
export function weekLog(
  tasks: CleaningTask[],
  weekIso: string,
  signOf: (task: CleaningTask, iso: string) => CleaningSignOff | null,
  nowMs: number,
): WeekLogRow[] {
  const days = weekDates(weekIso);
  return sortForShift(tasks).map((task) => ({
    task,
    cells: days.map((iso, i) => {
      if (task.freq === 'weekly' && task.day !== i) return null;
      const sign = signOf(task, iso);
      return { task, iso, sign, status: cleaningStatus(task, iso, sign, nowMs) };
    }),
  }));
}

/** Cells in a week's log that need a manager's attention: missed or overdue. */
export function needsAttention(log: WeekLogRow[]): number {
  return log.reduce((n, row) => n + row.cells.filter((c) => c && (c.status === 'missed' || c.status === 'overdue')).length, 0);
}
