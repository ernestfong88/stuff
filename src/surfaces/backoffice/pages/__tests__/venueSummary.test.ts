import { describe, expect, it } from 'vitest';
import { weekStart } from '../../../../domain/menuCycle';
import type { MenuSummary, Venue } from '../../../../store/venueSettings';
import { kitchenLine, servingLines, thisWeek, venueKind } from '../venues/summary';

const DAY = 86_400_000;
const venue = (patch: Partial<Venue>): Venue => ({
  id: 'v1',
  name: 'Sequoia Dining Room',
  room: 'sequoia',
  menuId: null,
  menuStartDt: null,
  active: true,
  upcoming: [],
  ...patch,
});
const menus: MenuSummary[] = [
  { id: 'm1', name: 'VT Fall 2026', season: '', quarter: 'Q4 2026', kind: 'cycle', status: 'active', cycleLen: 28 },
  { id: 'm1:everyday', name: 'VT Fall 2026 · Every-day items', season: '', quarter: 'Q4 2026', kind: 'alc', status: 'active', cycleLen: 0 },
  { id: 'm2', name: 'Bistro All-Day', season: '', quarter: '', kind: 'alc', status: 'active', cycleLen: 0 },
];
// A Wednesday, and the Sunday a week before its own week's Sunday: week 2 of 4.
const at = new Date(2026, 9, 7, 12).getTime();
const start = weekStart(at).getTime() - 7 * DAY;

describe('a venue in plain words', () => {
  it('says what it serves now, one line per menu, with the week of the cycle', () => {
    expect(servingLines(venue({ menuId: 'm1', menuStartDt: start, alcMenuId: 'm1:everyday' }), menus, at)).toEqual([
      'Cycle: VT Fall 2026 · week 2 of 4',
      'À la carte: VT Fall 2026 · Every-day items',
    ]);
    expect(servingLines(venue({ alcMenuId: 'm2' }), menus, at)).toEqual(['À la carte: Bistro All-Day']);
    // An older venue that kept its à la carte menu as its menu.
    expect(servingLines(venue({ menuId: 'm2' }), menus, at)).toEqual(['À la carte: Bistro All-Day']);
    expect(servingLines(venue({ menuId: 'm1' }), menus, at)).toEqual(['Cycle: VT Fall 2026 · week 1 date not set']);
    expect(servingLines(venue({}), menus, at)).toEqual([]);
  });

  it('says which week of the cycle this week is, live from week 1', () => {
    expect(thisWeek({ menuStartDt: start }, menus[0], at)).toBe('This week is week 2 of 4');
    expect(thisWeek({ menuStartDt: start - 7 * DAY }, menus[0], at)).toBe('This week is week 3 of 4');
    expect(thisWeek({ menuStartDt: null }, menus[0], at)).toBeNull();
  });

  it('names the kind of place from its name and kitchen', () => {
    expect(venueKind(venue({}))).toBe('Dining room');
    expect(venueKind(venue({ name: 'The Bistro', room: 'bistro' }))).toBe('Bistro');
    expect(venueKind(venue({ name: 'Catering', room: null }))).toBe('Catering');
    expect(venueKind(venue({ name: 'Garden Room', room: null }))).toBe('Catering');
  });

  it('says whose kitchen and tablets a venue uses', () => {
    const sequoia = venue({});
    const evergreen = venue({ id: 'v2', name: 'Evergreen Dining Room' });
    const all = [sequoia, evergreen, venue({ id: 'v3', name: 'The Bistro', room: 'bistro' }), venue({ id: 'v4', name: 'Catering', room: null })];
    expect(kitchenLine(evergreen, all)).toBe("Shares Sequoia Dining Room's kitchen & tablets");
    expect(kitchenLine(sequoia, all)).toMatch(/kitchen & tablets, shared with Evergreen Dining Room$/);
    expect(kitchenLine(all[2], all)).toMatch(/kitchen$/);
    expect(kitchenLine(all[3], all)).toBe('No kitchen: orders print only');
    // Once Sequoia retires, Evergreen has the kitchen to itself.
    expect(kitchenLine(evergreen, [{ ...sequoia, active: false }, evergreen])).not.toMatch(/Shares/);
  });
});
