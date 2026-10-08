import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { T0, diner, freezeClock, line, order } from '../../../../domain/__tests__/helpers';
import { orderTime, orderTimeLabel } from '../orderTime';

const MIN = 60_000;

beforeEach(() => freezeClock());
afterEach(() => vi.useRealTimers());

describe('orderTime', () => {
  it('falls back to when the check was opened while nothing is sent', () => {
    const o = order([diner([line('d_peach')])], { openedAt: T0 - 12 * MIN });
    expect(orderTime(o)).toEqual({ kind: 'opened', at: T0 - 12 * MIN });
    expect(orderTimeLabel(orderTime(o))).toBe('Opened 5:48 PM');
  });

  it('is the first time anything went to the kitchen, not the latest send', () => {
    const o = order(
      [
        diner([
          line('d_cbsoup', { sent: true, kitchenState: 'cleared', course: 1, firedAt: T0 - 20 * MIN }),
          line('d_peach', { sent: true, kitchenState: 'cooking', course: 2, firedAt: T0 - 4 * MIN }),
        ]),
      ],
      { openedAt: T0 - 25 * MIN, sentAt: T0 - 4 * MIN },
    );
    expect(orderTime(o)).toEqual({ kind: 'ordered', at: T0 - 20 * MIN });
    expect(orderTimeLabel(orderTime(o))).toBe('Ordered 5:40 PM');
  });

  it('counts a course held for later as ordered when it was sent', () => {
    const o = order([diner([line('d_peach', { sent: true, kitchenState: 'scheduled', course: 2, firedAt: T0 - 3 * MIN })])], {
      openedAt: T0 - 9 * MIN,
    });
    expect(orderTime(o)).toEqual({ kind: 'ordered', at: T0 - 3 * MIN });
  });
});
