import { describe, expect, it } from 'vitest';
import { amountToReview, chargesToReview } from '../billing';
import { bandLayout, barHeight, ringSlicePath, sharePct, sliceAngles } from '../charts/scale';
import { nextSort } from '../index';
import type { Charge } from '../../seed/billing';

describe('chart scale', () => {
  it('maps values between floor and ceiling onto the plot, clamped', () => {
    expect(barHeight(15, 10, 20, 100)).toBe(50);
    expect(barHeight(5, 10, 20, 100)).toBe(0);
    expect(barHeight(30, 10, 20, 100)).toBe(100);
    expect(barHeight(1, 1, 1, 100)).toBe(0);
  });
  it('lays bars across the width with gaps', () => {
    const b = bandLayout(4, 100, 4);
    expect(b).toHaveLength(4);
    expect(b[3].x + b[3].w).toBeCloseTo(100);
    expect(b[1].x - (b[0].x + b[0].w)).toBeCloseTo(4);
    expect(bandLayout(0, 100, 4)).toEqual([]);
  });
  it('fills the circle with slices in order', () => {
    const a = sliceAngles([1, 1, 2]);
    expect(a[0].a0).toBe(0);
    expect(a[1].a1).toBeCloseTo(Math.PI);
    expect(a[2].a1).toBeCloseTo(Math.PI * 2);
  });
  it('draws a full ring as two arcs', () => {
    expect(ringSlicePath(120, 120, 70, 110, 0, Math.PI * 2).match(/M/g)).toHaveLength(2);
    expect(ringSlicePath(120, 120, 70, 110, 0, 1).startsWith('M120 10')).toBe(true);
  });
  it('never rounds a real share down to zero', () => {
    expect(sharePct(1, 1000)).toBe(1);
    expect(sharePct(0, 10)).toBe(0);
  });
});

describe('table sort', () => {
  it('flips the same column and starts a new one ascending', () => {
    expect(nextSort({ key: 'name', dir: 1 }, 'name')).toEqual({ key: 'name', dir: -1 });
    expect(nextSort({ key: 'name', dir: -1 }, 'apt')).toEqual({ key: 'apt', dir: 1 });
  });
});

describe('charges to review', () => {
  const c = (id: string, patch: Partial<Charge>): Charge => ({
    id,
    residentId: 'r1',
    level: 'IL',
    date: 0,
    item: 'TRAY',
    desc: '',
    amount: 5,
    active: true,
    approvedAt: null,
    approvedBy: null,
    importedAt: null,
    source: 'delivery',
    ...patch,
  });
  const list = [c('a', {}), c('b', { active: false }), c('c', { approvedAt: 1 }), c('d', { importedAt: 1, amount: 50 })];
  it('counts unapproved charges, voided ones included', () => {
    expect(chargesToReview(list).map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('adds up only live charges', () => {
    expect(amountToReview(list)).toBe(5);
  });
});
