import { beforeEach, describe, expect, it } from 'vitest';
import type { Order } from '../../domain/types';
import { setClockOffset } from '../../lib/clock';
import { eightySixStore, fewerLeft, is86, itemsMarked, itemsOut, limitLeft, limitOf, ordersToday, restore86, set86, setLeft } from '../eightySix';

/** Pin the demo clock to Thursday Oct 8 2026 at h:m. */
function clockAt(h: number, m = 0, date = 8) {
  setClockOffset(0);
  setClockOffset(new Date(2026, 9, date, h, m).getTime() - Date.now());
}

/** An order holding these item ids, opened at `openedAt`. */
const order = (ids: string[], openedAt = new Date(2026, 9, 8, 17).getTime()) =>
  ({ openedAt, diners: [{ items: ids.map((itemId) => ({ itemId })) }] }) as unknown as Order;

describe('86 store', () => {
  beforeEach(() => {
    clockAt(17, 45);
    eightySixStore.reset();
  });

  it('marks an item out and back on', () => {
    set86('a', true);
    expect(is86(eightySixStore.get(), 'a')).toBe(true);
    expect(itemsOut(eightySixStore.get())).toEqual(['a']);
    set86('a', false);
    expect(itemsMarked(eightySixStore.get())).toEqual([]);
  });

  it('counts down a set count by what is ordered after it was set', () => {
    const before = [order(['a', 'a'])];
    setLeft('a', 4, before);
    const marks = eightySixStore.get();
    expect(is86(marks, 'a')).toBe(false);
    expect(itemsMarked(marks)).toEqual(['a']);
    expect(limitLeft(marks, 'a', before)).toBe(4);
    expect(limitLeft(marks, 'a', [...before, order(['a', 'b'])])).toBe(3);
    expect(limitLeft(marks, 'a', [...before, order(['a', 'a', 'a', 'a', 'a'])])).toBe(0);
    expect(limitLeft(marks, 'b', before)).toBeNull();
  });

  it('switches between out and a count, and Undo puts back what was there', () => {
    setLeft('a', 3, []);
    const counted = eightySixStore.get().a;
    set86('a', true);
    expect(limitOf(eightySixStore.get(), 'a')).toBeNull();
    expect(is86(eightySixStore.get(), 'a')).toBe(true);
    restore86('a', counted);
    expect(limitOf(eightySixStore.get(), 'a')?.left).toBe(3);
    restore86('a', undefined);
    expect(itemsMarked(eightySixStore.get())).toEqual([]);
  });

  it('comes back on its own the next day', () => {
    set86('a', true);
    setLeft('b', 2, []);
    clockAt(9, 0, 9);
    expect(itemsMarked(eightySixStore.get())).toEqual([]);
    set86('c', true);
    expect(Object.keys(eightySixStore.get())).toEqual(['c']);
  });

  it('counts today’s open and closed checks, and takes the smaller of two limits', () => {
    const old = order(['a'], new Date(2026, 9, 7, 18).getTime());
    expect(ordersToday([order(['a'])], [old, order(['a'])])).toHaveLength(2);
    expect([fewerLeft(null, 3), fewerLeft(5, null), fewerLeft(5, 3), fewerLeft(null, null)]).toEqual([3, 5, 3, null]);
  });
});
