import { describe, expect, it } from 'vitest';
import {
  addDays,
  cleaningStatus,
  needsAttention,
  periodOf,
  shortName,
  sortForShift,
  tasksDueOn,
  weekDates,
  weekLog,
  weekOf,
  weeklyDueDate,
  type CleaningSignOff,
  type CleaningTask,
} from '../cleaning';

const daily = (id: string, when: CleaningTask['when'], assignee: string | null = null): CleaningTask => ({
  id,
  text: id,
  freq: 'daily',
  when,
  day: 0,
  assignee,
});
const weekly = (id: string, day: number, assignee: string | null = null): CleaningTask => ({
  id,
  text: id,
  freq: 'weekly',
  when: 'close',
  day,
  assignee,
});
/** Thursday Oct 8 2026 at h:m. */
const thu = (h: number, m = 0) => new Date(2026, 9, 8, h, m).getTime();
const sign: CleaningSignOff = { staffId: 'TR', by: 'T. Reyes', at: thu(6, 10) };

describe('cleaning weeks', () => {
  it('runs weeks Sunday to Saturday', () => {
    expect(weekOf('2026-10-08')).toBe('2026-10-04');
    expect(weekOf('2026-10-04')).toBe('2026-10-04');
    expect(weekOf('2026-10-10')).toBe('2026-10-04');
    expect(weekDates('2026-10-04')).toEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('keeps a daily sign-off by day and a weekly one by week', () => {
    expect(periodOf(daily('a', 'open'), '2026-10-08')).toBe('2026-10-08');
    expect(periodOf(weekly('b', 3), '2026-10-08')).toBe('2026-10-04');
    expect(weeklyDueDate(weekly('b', 3), '2026-10-08')).toBe('2026-10-07');
  });

  it('lists every daily task and the weekly ones due that weekday', () => {
    const tasks = [daily('a', 'open'), weekly('wed', 3), weekly('thu', 4)];
    expect(tasksDueOn(tasks, '2026-10-08').map((t) => t.id)).toEqual(['a', 'thu']);
    expect(tasksDueOn(tasks, '2026-10-07').map((t) => t.id)).toEqual(['a', 'wed']);
  });

  it('orders a shift: Opening, Mid-day, Closing, then weekly by due day', () => {
    const tasks = [weekly('fri', 5), daily('close', 'close'), weekly('mon', 1), daily('open', 'open'), daily('mid', 'mid')];
    expect(sortForShift(tasks).map((t) => t.id)).toEqual(['open', 'mid', 'close', 'mon', 'fri']);
  });

  it('shortens names the way the kitchen signs', () => {
    expect(shortName('Tomas Reyes')).toBe('T. Reyes');
  });
});

describe('cleaning status', () => {
  it('a daily task is open until its time passes, then overdue; missed once the day is over', () => {
    const open = daily('a', 'open');
    expect(cleaningStatus(open, '2026-10-08', null, thu(9, 59))).toBe('open');
    expect(cleaningStatus(open, '2026-10-08', null, thu(10, 0))).toBe('overdue');
    expect(cleaningStatus(open, '2026-10-08', sign, thu(10, 0))).toBe('done');
    expect(cleaningStatus(open, '2026-10-07', null, thu(8))).toBe('missed');
    expect(cleaningStatus(open, '2026-10-09', null, thu(8))).toBe('upcoming');
    expect(cleaningStatus(daily('c', 'close'), '2026-10-08', null, thu(17, 45))).toBe('open');
  });

  it('a weekly task is due on its day, overdue after it, and missed once the week is over', () => {
    expect(cleaningStatus(weekly('thu', 4), '2026-10-08', null, thu(8))).toBe('due');
    expect(cleaningStatus(weekly('wed', 3), '2026-10-08', null, thu(8))).toBe('overdue');
    expect(cleaningStatus(weekly('sat', 6), '2026-10-08', null, thu(8))).toBe('upcoming');
    expect(cleaningStatus(weekly('wed', 3), '2026-09-30', null, thu(8))).toBe('missed');
    expect(cleaningStatus(weekly('wed', 3), '2026-10-08', sign, thu(8))).toBe('done');
  });
});

describe('a week of the log', () => {
  it('gives a daily task seven cells and a weekly task one, and counts what needs attention', () => {
    const tasks = [daily('a', 'open'), weekly('wed', 3)];
    // Signed every day so far but Tuesday; the weekly task is not signed.
    const log = weekLog(tasks, '2026-10-04', (t, iso) => (t.id === 'a' && iso !== '2026-10-06' && iso <= '2026-10-08' ? sign : null), thu(12));
    expect(log.map((r) => r.task.id)).toEqual(['a', 'wed']);
    expect(log[0].cells.map((c) => c?.status)).toEqual(['done', 'done', 'missed', 'done', 'done', 'upcoming', 'upcoming']);
    expect(log[1].cells.map((c) => c?.status ?? null)).toEqual([null, null, null, 'overdue', null, null, null]);
    expect(needsAttention(log)).toBe(2);
  });
});
