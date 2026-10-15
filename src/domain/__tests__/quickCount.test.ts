import { describe, expect, it } from 'vitest';
import { COUNT_MAX, QUICK_ADD_STEPS, addToCount } from '../quickCount';

describe('quick-add production counts', () => {
  it('offers +25, +50 and +100', () => {
    expect(QUICK_ADD_STEPS).toEqual([25, 50, 100]);
  });

  it('adds up taps: 100 then 25 is 125', () => {
    expect(addToCount(addToCount(0, 100), 25)).toBe(125);
  });

  it('adds to the count as it stands', () => {
    expect(addToCount(34, 50)).toBe(84);
  });

  it('treats an unset or invalid count as 0', () => {
    expect(addToCount(null, 25)).toBe(25);
    expect(addToCount(undefined, 50)).toBe(50);
    expect(addToCount(Number.NaN, 100)).toBe(100);
    expect(addToCount(-5, 25)).toBe(25);
  });

  it('keeps counts whole', () => {
    expect(addToCount(12.6, 25)).toBe(37);
  });

  it('stops at the maximum', () => {
    expect(addToCount(COUNT_MAX - 10, 100)).toBe(COUNT_MAX);
    expect(addToCount(90, 25, 100)).toBe(100);
  });

  it('never subtracts', () => {
    expect(addToCount(40, -25)).toBe(40);
  });
});
