import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, isoOf, weekOf } from '../../domain/cleaning';
import { now, setClockOffset } from '../../lib/clock';
import {
  cleaningSign,
  cleaningStore,
  cleaningTasksFor,
  kitchenCrew,
  setCleaningTasks,
  signCleaning,
  starterCleaningTasks,
  unsignCleaning,
} from '../cleaning';

/** Pin the demo clock to Thursday Oct 8 2026 at h:m. */
function clockAt(h: number, m = 0) {
  setClockOffset(0);
  setClockOffset(new Date(2026, 9, 8, h, m).getTime() - Date.now());
}

describe('cleaning store', () => {
  beforeEach(() => {
    clockAt(17, 45);
    cleaningStore.reset();
  });

  it('starts with the old checklist cleaning as daily tasks and a weekly set, assigned to real kitchen staff', () => {
    const tasks = starterCleaningTasks();
    const daily = tasks.filter((t) => t.freq === 'daily');
    expect(daily.map((t) => t.text)).toContain('Break down and clean the slicer');
    expect(daily.filter((t) => t.when === 'open')).toHaveLength(3);
    expect(tasks.filter((t) => t.freq === 'weekly').map((t) => t.text)).toEqual(
      expect.arrayContaining([
        'Delime the dish machine',
        'Clean the hood filters',
        'Deep-clean the walk-in shelves',
        'Clean and sanitize the ice machine',
      ]),
    );
    const crew = kitchenCrew().map((c) => c.id);
    expect(crew).toEqual(expect.arrayContaining(['TR', 'GK', 'JB', 'OD']));
    for (const t of tasks) if (t.assignee) expect(crew).toContain(t.assignee);
    expect(tasks.some((t) => !t.assignee)).toBe(true);
  });

  it('seeds sign-offs for the last four weeks, never later than now', () => {
    const s = cleaningStore.get();
    const tasks = cleaningTasksFor(s, 'sequoia');
    const today = isoOf(new Date(now()));
    let count = 0;
    for (let d = -27; d <= 2; d++) {
      for (const t of tasks) {
        const sign = cleaningSign(s, 'sequoia', t, addDays(today, d));
        if (!sign) continue;
        count++;
        expect(sign.at).toBeLessThanOrEqual(now());
      }
    }
    expect(count).toBeGreaterThan(100);
    // Opening is done this morning; closing is still ahead.
    const open = tasks.find((t) => t.freq === 'daily' && t.when === 'open')!;
    const close = tasks.find((t) => t.freq === 'daily' && t.when === 'close')!;
    expect(cleaningSign(s, 'sequoia', open, today)).not.toBeNull();
    expect(cleaningSign(s, 'sequoia', close, today)).toBeNull();
    // This week the hood filters (Tuesday) are done, the walk-in shelves (Wednesday) are left overdue and the ice machine (today) is still to do.
    const weekly = (text: string) => cleaningSign(s, 'sequoia', tasks.find((t) => t.text === text)!, today);
    expect(weekly('Clean the hood filters')?.at).toBeLessThan(new Date(2026, 9, 7).getTime());
    expect(weekly('Deep-clean the walk-in shelves')).toBeNull();
    expect(weekly('Clean and sanitize the ice machine')).toBeNull();
  });

  it('records who signed off with their PIN, even when it was assigned to someone else, and can un-sign', () => {
    const task = cleaningTasksFor(cleaningStore.get(), 'sequoia').find((t) => t.text === 'Break down and clean the slicer')!;
    expect(task.assignee).toBe('TR');
    const today = isoOf(new Date(now()));
    const before = now();
    signCleaning('sequoia', task, today, 'GK', 'Grace Kim');
    const sign = cleaningSign(cleaningStore.get(), 'sequoia', task, today);
    expect(sign).toMatchObject({ staffId: 'GK', by: 'G. Kim' });
    expect(sign!.at).toBeGreaterThanOrEqual(before);
    expect(sign!.at).toBeLessThanOrEqual(now());
    unsignCleaning('sequoia', task, today);
    expect(cleaningSign(cleaningStore.get(), 'sequoia', task, today)).toBeNull();
  });

  it('keeps one sign-off a week for a weekly task, whichever day it was done', () => {
    const task = cleaningTasksFor(cleaningStore.get(), 'bistro').find((t) => t.text === 'Deep-clean the walk-in shelves')!;
    const today = isoOf(new Date(now()));
    signCleaning('bistro', task, today, 'OD', 'Oscar Delgado');
    expect(cleaningSign(cleaningStore.get(), 'bistro', task, weekOf(today))?.by).toBe('O. Delgado');
    expect(cleaningSign(cleaningStore.get(), 'bistro', task, addDays(weekOf(today), 6))?.by).toBe('O. Delgado');
  });

  it('keeps edited lists per kitchen; null brings back the starter list', () => {
    setCleaningTasks('evergreen', [{ id: 'x', text: 'Polish the hood', freq: 'weekly', when: 'close', day: 2, assignee: null }]);
    expect(cleaningTasksFor(cleaningStore.get(), 'evergreen').map((t) => t.text)).toEqual(['Polish the hood']);
    expect(cleaningTasksFor(cleaningStore.get(), 'sequoia')).toHaveLength(starterCleaningTasks().length);
    setCleaningTasks('evergreen', null);
    expect(cleaningTasksFor(cleaningStore.get(), 'evergreen')).toHaveLength(starterCleaningTasks().length);
  });
});
