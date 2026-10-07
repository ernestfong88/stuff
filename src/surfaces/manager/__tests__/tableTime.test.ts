import { describe, expect, it } from 'vitest';
import { TABLE_TIME_GOAL, tableTimeOf, tableTimeTrend } from '../metrics/tableTime';

describe('average table time', () => {
  it('adds the two steps, and is unknown without both', () => {
    expect(tableTimeOf({ app: 6, ent: 14 })).toBe(20);
    expect(tableTimeOf({ app: null, ent: 14 })).toBeNull();
    expect(TABLE_TIME_GOAL).toBe(22);
  });

  it('compares this meal with the last seven, within half a minute is steady', () => {
    const week = [{ app: 6, ent: 15 }, { app: 7, ent: 15 }];
    expect(tableTimeTrend(20, week)).toEqual({ delta: -1.5, dir: 'faster' });
    expect(tableTimeTrend(23, week).dir).toBe('slower');
    expect(tableTimeTrend(21.6, week).dir).toBe('steady');
    expect(tableTimeTrend(null, week).dir).toBe('none');
  });
});
