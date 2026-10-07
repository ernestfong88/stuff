import { describe, expect, it } from 'vitest';
import seed from '../seed/production.json';
import { PLAN_DAYS, productionDay } from '../../../store/production';

interface SeedRow {
  id: string;
  kind: string;
  name: string;
  recommended?: number;
}
const seededDays = (seed as unknown as { menus: { cycle: { production: Array<{ cycleDay: number; rows: SeedRow[] }> } } }).menus.cycle.production;

describe('production plan from the menu cycle', () => {
  it('reproduces the prototype for today, tomorrow and the day after', () => {
    seededDays.forEach((want, off) => {
      const day = productionDay('sequoia', off);
      expect(day.cycleDay).toBe(want.cycleDay);
      expect(day.rows.filter((r) => r.kind === 'special').map((r) => [r.id, r.name, r.recommended])).toEqual(
        want.rows.filter((r) => r.kind === 'special').map((r) => [r.id, r.name, r.recommended]),
      );
    });
  });

  it('plans every day of the next two weeks on consecutive cycle days', () => {
    const days = Array.from({ length: PLAN_DAYS }, (_, off) => productionDay('sequoia', off));
    days.forEach((d, i) => {
      expect(d.rows.some((r) => r.kind === 'special')).toBe(true);
      if (i > 0) expect(d.cycleDay).toBe((days[i - 1].cycleDay % 35) + 1);
    });
    expect(new Set(days.map((d) => d.iso)).size).toBe(PLAN_DAYS);
  });

  it('gives a fixed-menu venue its always-available dishes every day', () => {
    const day = productionDay('bistro', 6);
    expect(day.cycleDay).toBe(0);
    expect(day.rows.length).toBeGreaterThan(0);
    expect(day.rows.every((r) => r.kind === 'anyDay')).toBe(true);
  });
});
