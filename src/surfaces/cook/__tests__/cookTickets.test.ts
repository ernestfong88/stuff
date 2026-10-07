import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../domain/config';
import { diner, line, order } from '../../../domain/__tests__/helpers';
import { screensForItem, type KdsScreen } from '../../../domain/kdsScreens';
import seed from '../../../data/seed/venueSettings.json';
import { allDayCounts, averageTicketMinutes, buildCookTickets, bumpLineIds, plateDetails, ticketStatus } from '../cookTickets';

const SEQUOIA = (seed as unknown as { kds: { sequoia: KdsScreen[] } }).kds.sequoia;
const screensOf = (itemId: string, room: string) => screensForItem(itemId, room, room === 'sequoia' ? SEQUOIA : [], {});
const opts = (screen = 'sequoia:0', expoActive = true) => ({ screen, expoActive, cfg: DEFAULT_CONFIG, screensOf });
const fired = (itemId: string, extra = {}) => line(itemId, { sent: true, kitchenState: 'cooking', firedAt: 1000, course: 2, ...extra });

describe('cook tickets', () => {
  it('makes one ticket per course with the plates the cook makes', () => {
    const entree = fired('d_peach');
    const soup = fired('d_cbsoup', { course: 1, kitchenState: 'ready' }); // the server makes soup
    const held = line('d_trifle', { sent: true, kitchenState: 'scheduled', course: 3 });
    const o = order([diner([entree, soup, held])]);
    const t = buildCookTickets([o], opts());
    expect(t).toHaveLength(1);
    expect(t[0].id).toBe(o.id + '#2');
    expect(t[0].lines.map((l) => l.id)).toEqual([entree.id]);
  });

  it('carries the diner’s sides on the entree, and only shows a side alone on another screen', () => {
    const entree = fired('d_peach');
    const potato = fired('d_mashed', { parentId: entree.id, autoSide: true });
    const salad = fired('d_sidesalad', { parentId: entree.id, autoSide: true });
    const o = order([diner([entree, potato, salad])]);
    const hot = buildCookTickets([o], opts('sequoia:0'))[0];
    expect(hot.lines.map((l) => l.itemId)).toEqual(['d_peach']);
    expect(hot.lines[0].sideLines.map((l) => l.itemId)).toEqual(['d_mashed', 'd_sidesalad']);
    // The side salad is a cold screen plate: the hot bump marks only its own sides.
    expect(bumpLineIds(hot, 'sequoia:0', screensOf)).toEqual([entree.id, potato.id]);
  });

  it('drops a ticket once every plate is up when expo runs it, keeps it without expo', () => {
    const o = order([diner([fired('d_peach', { kitchenState: 'ready' })])]);
    expect(buildCookTickets([o], opts('sequoia:0', true))).toHaveLength(0);
    const t = buildCookTickets([o], opts('sequoia:0', false));
    expect(ticketStatus(t[0], 'sequoia:0').allReady).toBe(true);
  });

  it('puts remakes on the fire first, then oldest first', () => {
    const a = order([diner([fired('d_peach', { firedAt: 100 })])]);
    const b = order([diner([fired('d_shells', { firedAt: 50 })])]);
    const c = order([diner([fired('l_burger', { firedAt: 500, rush: true })])]);
    expect(buildCookTickets([a, b, c], opts()).map((t) => t.orderId)).toEqual([c.id, b.id, a.id]);
  });

  it('tells apart a ticket left with only cancelled plates', () => {
    const o = order([diner([fired('d_peach', { cancelled: true })])]);
    const st = ticketStatus(buildCookTickets([o], opts())[0], 'sequoia:0');
    expect(st.onlyCancelled).toBe(true);
    expect(st.allReady).toBe(false);
  });

  it('averages fire-to-bump minutes over the last hour', () => {
    const o = order([diner([fired('d_peach', { firedAt: 0 })])], { openedAt: 0 });
    expect(averageTicketMinutes([{ order: o, at: 10 * 60_000 }], 11 * 60_000)).toBe(10);
    expect(averageTicketMinutes([{ order: o, at: 0 }], 2 * 3_600_000)).toBeNull();
  });
});

describe('all day counts', () => {
  it('counts the plates still to make on this screen, most first', () => {
    const a = order([diner([fired('d_peach'), fired('d_shells')]), diner([fired('d_peach')])]);
    const b = order([diner([fired('d_peach', { kitchenState: 'ready' }), fired('d_shells', { cancelled: true }), fired('d_peach')])]);
    const tickets = buildCookTickets([a, b], opts('all'));
    expect(allDayCounts(tickets, 'all', (id) => id)).toEqual([
      { name: 'd_peach', count: 3 },
      { name: 'd_shells', count: 1 },
    ]);
  });

  it('is empty when the line is clear', () => {
    expect(allDayCounts([], 'all', (id) => id)).toEqual([]);
  });
});

describe('plate details', () => {
  const name = (id: string) => id;
  it('calls out sides that are not the default and flags an entree with none', () => {
    const entree = { ...fired('d_peach'), dinerId: 'd', diner: diner([]), screens: [], sideLines: [fired('d_fries')] };
    const d = plateDetails(entree, { defaultSidesOnLine: true, name });
    expect(d.callouts).toEqual(['d_fries']);
    const bare = plateDetails({ ...entree, sideLines: [] }, { defaultSidesOnLine: true, name });
    expect(bare.noSides).toBe(true);
  });

  it('drops the REMAKE the store adds to a remake’s note', () => {
    const l = { ...fired('d_peach', { rush: true, note: 'Too dry · REMAKE' }), dinerId: 'd', diner: diner([]), screens: [], sideLines: [] };
    expect(plateDetails(l, { defaultSidesOnLine: false, name }).note).toBe('Too dry');
  });
});
