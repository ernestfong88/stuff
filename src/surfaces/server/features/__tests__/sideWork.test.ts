import { describe, expect, it } from 'vitest';
import {
  autoAssign,
  dayFor,
  fitsShift,
  libraryFor,
  parseTaskMinutes,
  seedDay,
  shiftTime,
  staffOnShift,
  tasksFor,
  withAssignment,
  withCheck,
  withCleared,
  type SideWorkState,
} from '../../../../store/sideWork';

const empty: SideWorkState = { libs: {}, days: {} };
const ISO = '2026-10-07';

describe('side work', () => {
  it('works out shifts and meals from the roster', () => {
    const [sofia] = staffOnShift('sequoia');
    expect(sofia.tag).toBe('open');
    expect(sofia.meals).toEqual(['B', 'L']);
    expect(fitsShift({ when: 'open' }, sofia)).toBe(true);
    expect(fitsShift({ when: 'D' }, sofia)).toBe(false);
    expect(shiftTime(360)).toBe('6 AM');
    expect(shiftTime(870)).toBe('2:30 PM');
  });

  it('auto-assign spreads what is left, longest first, to who works that shift', () => {
    const lib = libraryFor(empty, 'sequoia');
    const people = staffOnShift('sequoia');
    const { asg, count } = autoAssign(lib, people, {});
    expect(count).toBe(lib.length);
    for (const t of lib) {
      const p = people.find((x) => x.id === asg[t.id])!;
      const anyFit = people.some((x) => fitsShift(t, x));
      if (anyFit) expect(fitsShift(t, p)).toBe(true);
    }
    expect(autoAssign(lib, people, asg).count).toBe(0);
    expect(autoAssign(lib, [], {}).count).toBe(0);
  });

  it('assigns, checks off and clears, keeping what was done', () => {
    let s = withAssignment(empty, 'bistro', ISO, 'sw0', 'MC');
    s = withAssignment(s, 'bistro', ISO, 'sw1', 'MC');
    s = withCheck(s, 'bistro', ISO, 'sw0', 'MC', true, 1000);
    expect(dayFor(s, 'bistro', ISO).done.sw0).toEqual({ at: 1000, by: 'MC' });
    s = withCleared(s, 'bistro', ISO);
    expect(dayFor(s, 'bistro', ISO).asg).toEqual({ sw0: 'MC' });
    s = withCheck(s, 'bistro', ISO, 'sw0', 'MC', false);
    expect(dayFor(s, 'bistro', ISO).done.sw0).toBeUndefined();
  });

  it("lists a person's tasks across venues", () => {
    const day = '2030-01-02';
    let s = withAssignment(empty, 'bistro', day, 'sw3', 'AA');
    s = withAssignment(s, 'sequoia', day, 'sw2', 'AA');
    const mine = tasksFor(s, 'AA', day);
    expect(mine.map((t) => t.venue + ':' + t.id).sort()).toEqual(['bistro:sw3', 'sequoia:sw2']);
  });

  it('seeds only today at Sequoia, with checks before now', () => {
    const at = new Date(2026, 9, 7, 9, 0).getTime();
    const day = seedDay('sequoia', ISO, at);
    expect(Object.keys(day.done).sort()).toEqual(['sw0', 'sw1', 'sw4']);
    expect(seedDay('bistro', ISO, at)).toEqual({ asg: {}, done: {} });
    expect(seedDay('sequoia', '2026-10-08', at)).toEqual({ asg: {}, done: {} });
  });

  it('reads minutes typed in a box', () => {
    expect(parseTaskMinutes('')).toBeNull();
    expect(parseTaskMinutes(' 12 ')).toBe(12);
    expect(parseTaskMinutes('999')).toBe(240);
    expect(parseTaskMinutes('-3')).toBe(0);
  });
});
