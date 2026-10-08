import { describe, expect, it } from 'vitest';
import { dayValue, inRange, isRangeSet, parseDay, rangeBounds, withPreset, type DateRange } from '../dateRange';

// Thursday 8 October 2026, 3:30 pm local.
const at = new Date(2026, 9, 8, 15, 30).getTime();
const on = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();

describe('date range filter', () => {
  it('reads each preset in local days', () => {
    expect(rangeBounds({ preset: 'all' }, at)).toBeNull();
    expect(rangeBounds({ preset: 'today' }, at)).toEqual({ start: new Date(2026, 9, 8).getTime(), end: new Date(2026, 9, 9).getTime() });
    expect(rangeBounds({ preset: 'yesterday' }, at)).toEqual({ start: new Date(2026, 9, 7).getTime(), end: new Date(2026, 9, 8).getTime() });
    expect(rangeBounds({ preset: 'last7' }, at)).toEqual({ start: new Date(2026, 9, 2).getTime(), end: new Date(2026, 9, 9).getTime() });
    expect(rangeBounds({ preset: 'month' }, at)).toEqual({ start: new Date(2026, 9, 1).getTime(), end: new Date(2026, 10, 1).getTime() });
  });

  it('keeps times inside the range, start included and end left out', () => {
    expect(inRange(on(8, 0), { preset: 'today' }, at)).toBe(true);
    expect(inRange(on(7, 23), { preset: 'today' }, at)).toBe(false);
    expect(inRange(on(7, 23), { preset: 'yesterday' }, at)).toBe(true);
    expect(inRange(on(2, 0), { preset: 'last7' }, at)).toBe(true);
    expect(inRange(on(1, 23), { preset: 'last7' }, at)).toBe(false);
    expect(inRange(on(1, 0), { preset: 'month' }, at)).toBe(true);
    expect(inRange(new Date(2026, 8, 30, 23).getTime(), { preset: 'month' }, at)).toBe(false);
    expect(inRange(0, { preset: 'all' }, at)).toBe(true);
  });

  it('takes a custom range with both days included, open ends, and either order', () => {
    const r: DateRange = { preset: 'custom', from: '2026-10-03', to: '2026-10-05' };
    expect([on(2, 23), on(3, 0), on(5, 23), on(6, 0)].map((t) => inRange(t, r, at))).toEqual([false, true, true, false]);
    expect(inRange(on(4), { preset: 'custom', from: '2026-10-05', to: '2026-10-03' }, at)).toBe(true);
    expect(inRange(on(30), { preset: 'custom', from: '2026-10-05' }, at)).toBe(true);
    expect(inRange(on(6), { preset: 'custom', to: '2026-10-05' }, at)).toBe(false);
    expect(inRange(0, { preset: 'custom', from: '', to: '' }, at)).toBe(true);
  });

  it('says when it narrows anything, and fills Custom from the last 7 days', () => {
    expect([
      isRangeSet({ preset: 'all' }),
      isRangeSet({ preset: 'custom' }),
      isRangeSet({ preset: 'today' }),
      isRangeSet({ preset: 'custom', to: '2026-10-01' }),
    ]).toEqual([false, false, true, true]);
    expect(withPreset({ preset: 'today' }, 'custom', at)).toEqual({ preset: 'custom', from: '2026-10-02', to: '2026-10-08' });
    expect(withPreset({ preset: 'custom', from: '2026-09-01', to: '2026-09-02' }, 'month', at)).toEqual({ preset: 'month' });
    expect(dayValue(at)).toBe('2026-10-08');
    expect(parseDay('2026-10-8')).toBeNull();
  });
});
