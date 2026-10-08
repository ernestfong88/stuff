import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type DiningConfig } from '../../../../domain/config';
import { diner, freezeClock, line, order } from '../../../../domain/__tests__/helpers';
import { closeCheck, courseSendText, sendLabel, sentMessage } from '../checkLines';
import { defaultMods, pinnedGroupIds } from '../menu/modifiers';
import { upcharge } from '../../../../domain/menu';

beforeEach(() => freezeClock());
afterEach(() => vi.useRealTimers());

const mode = (m: 'off' | 'expo'): DiningConfig => ({ ...DEFAULT_CONFIG, course: { sequoia: { Dinner: m } } });

describe('what Send says', () => {
  it('names the courses that fire now and the ones that wait', () => {
    const soup = line('d_cbsoup');
    const entree = line('d_peach');
    const dessert = line('d_trifle');
    const o = order([diner([soup, entree, dessert])]);
    expect(courseSendText(o, [soup, entree, dessert])).toBe('C1 fires now, C2, C3 wait');
    // Fire all: everything but dessert goes now.
    expect(courseSendText(o, [soup, entree, dessert], mode('off'))).toBe('C1, C2 fire now, C3 waits');
    // An entrée sent while the soup is still out waits for it.
    const out = order([diner([line('d_cbsoup', { sent: true, kitchenState: 'cooking', course: 1 }), entree])]);
    expect(sendLabel(out, [entree], 0)).toBe('Send to kitchen · C2 waits for C1');
    expect(sendLabel(o, [entree], 0, { ...DEFAULT_CONFIG, kitchenMode: 'printers' })).toBe('Send to kitchen · ticket prints now');
  });

  it('a pick up booked ahead says when the kitchen fires it', () => {
    const o = order([diner([line('d_peach', { sent: true, kitchenState: 'scheduled' })])], { queueType: 'pickup', tableId: undefined, fireAtTs: Date.now() + 3_600_000 });
    expect(sentMessage(o)).toBe('Scheduled · the kitchen fires it at 7:00 PM');
  });
});

describe('closing with work still out', () => {
  it('counts items never sent (sides with their plate) and plates still in the kitchen', () => {
    const entree = line('d_peach');
    const side = line('d_mashed', { parentId: entree.id, autoSide: true });
    const cooking = line('d_cbsoup', { sent: true, kitchenState: 'cooking', course: 1 });
    const run = line('d_cbsoup', { sent: true, kitchenState: 'cleared', course: 1 });
    const o = order([diner([entree, side, cooking, run])]);
    const c = closeCheck(o);
    expect(c.unsentItems).toBe(1);
    expect(c.unsent.map((u) => u.line.id)).toEqual([entree.id, side.id]);
    expect(c.inKitchen).toBe(1);
    // Printers track nothing after the send.
    expect(closeCheck(o, { ...DEFAULT_CONFIG, kitchenMode: 'printers' }).inKitchen).toBe(0);
    expect(closeCheck(order([diner([run])]))).toMatchObject({ unsentItems: 0, inKitchen: 0 });
  });
});

describe('modifiers on the server tablet', () => {
  it('opens on the groups Back Office pins, and prices up-charges on groups without rules', () => {
    expect(pinnedGroupIds('d_burger')).toEqual(['g_temp', 'g_burger', 'g_cheese']);
    expect(upcharge({ itemId: 'd_burger', mods: { ...defaultMods('d_burger'), Burgers: ['Bacon'] } })).toBe(2);
  });
});
