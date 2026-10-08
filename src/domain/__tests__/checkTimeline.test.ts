import { describe, expect, it } from 'vitest';
import { MINUTE } from '../../lib/clock';
import { amberRedProblem, checkGaps, gapTone } from '../checkTimeline';
import type { OrderLogEvent } from '../types';

const ev = (min: number, k: string, what = ''): OrderLogEvent => ({ at: min * MINUTE, k, by: 'AA', what });

describe('check timeline gaps', () => {
  const log = [
    ev(0, 'open'),
    ev(1, 'seat'),
    ev(7, 'send'),
    ev(20, 'kstate', 'Peach Chicken up at the pass'),
    ev(21, 'kstate', 'Mashed Potatoes up at the pass'),
    ev(25, 'kstate', 'Ran Peach Chicken'),
    ev(37, 'checkin'),
  ];
  const settings = { send: [6, 8], ready: [15, 18], run: [2.5, 4], checkin: [10, 0] };

  it('measures each moment and colours it by the Alerts & Timing marks', () => {
    expect(checkGaps({ openedAt: 0, log }, settings)).toEqual([
      { key: 'send', label: 'Waiting to order', mins: 7, tone: 'amber' },
      { key: 'ready', label: 'Cooking', mins: 13, tone: 'ok' },
      { key: 'run', label: 'Plates up', mins: 5, tone: 'red' },
      { key: 'checkin', label: 'Eating', mins: 12, tone: 'amber' },
    ]);
  });

  it('keeps the slowest course and leaves out moments that never happened', () => {
    const printers = [ev(0, 'open'), ev(3, 'send'), ev(30, 'fire')];
    expect(checkGaps({ openedAt: 0, log: printers }, settings)).toEqual([{ key: 'send', label: 'Waiting to order', mins: 3, tone: 'ok' }]);
    const two = [...log, ev(40, 'fire'), ev(60, 'ready'), ev(61, 'run')];
    expect(checkGaps({ openedAt: 0, log: two }, settings).find((g) => g.key === 'ready')).toMatchObject({ mins: 20, tone: 'red' });
    expect(checkGaps({ openedAt: 0 }, settings)).toEqual([]);
  });

  it('treats 0 as off and checks amber comes before red', () => {
    expect(gapTone(99, [0, 0])).toBe('ok');
    expect(gapTone(5, [0, 4])).toBe('red');
    expect(amberRedProblem(25, 18)).toMatch(/before red/);
    expect(amberRedProblem(6, 8)).toBeNull();
    expect(amberRedProblem(10, 0)).toBeNull();
  });
});
