import { describe, expect, it } from 'vitest';
import type { Venue, VenueAdminView } from '../../../../store/venueSettings';
import { allVenueIssues, kitchenOf, venueIssues } from '../venues/issues';

const venue = (patch: Partial<Venue>): Venue => ({ id: 'v1', name: 'Sequoia', room: 'sequoia', menuId: 'm1', menuStartDt: 1, active: true, upcoming: [], ...patch });
const base: VenueAdminView = {
  venues: [],
  printers: [
    { id: 'p1', name: 'Hot Line', type: 'Kitchen', ip: '10.1.20.11', active: true, reachable: true },
    { id: 'p2', name: 'Expo Receipt', type: 'Receipt', ip: '10.1.20.13', active: true, reachable: false },
  ],
  printerLinks: [
    { id: 'l1', printerId: 'p1', venueId: 'v1' },
    { id: 'l2', printerId: 'p2', venueId: 'v1' },
  ],
  terminals: [{ id: 't1', name: 'Bistro terminal', venueId: 'v2', online: false, lastSeen: null }],
  kds: {},
  expo: {},
  menus: [
    { id: 'm1', name: 'VT Fall', season: '', quarter: 'Q4 2026', kind: 'cycle', status: 'active', cycleLen: 35 },
    { id: 'm2', name: 'Bistro', season: '', quarter: '', kind: 'alc', status: 'active', cycleLen: 0 },
  ],
};

describe('venue issues', () => {
  it('flags a venue with no menu, or a cycle menu with no week 1 date, on the Menu tab', () => {
    expect(venueIssues(base, venue({ id: 'x', menuId: null }))).toEqual([{ venueId: 'x', tab: 'menu', tone: 'danger', text: 'No menu, so it serves nothing' }]);
    expect(venueIssues(base, venue({ id: 'x', menuStartDt: null }))[0].text).toMatch(/no week 1 date/);
    expect(venueIssues(base, venue({ id: 'x', menuId: 'm2', menuStartDt: null }))).toEqual([]);
    // Only an à la carte menu is enough.
    expect(venueIssues(base, venue({ id: 'x', menuId: null, alcMenuId: 'm2' }))).toEqual([]);
  });

  it('flags printers that cannot be reached and terminals that are offline', () => {
    expect(venueIssues(base, venue({})).map((i) => [i.tab, i.text])).toEqual([['devices', "Expo Receipt printer can't be reached at 10.1.20.13"]]);
    expect(venueIssues(base, venue({ id: 'v2', menuId: 'm2' })).map((i) => i.text)).toEqual(['Bistro terminal is offline']);
  });

  it('skips retired venues', () => {
    const s = { ...base, venues: [venue({ id: 'x', menuId: null, active: false })] };
    expect(allVenueIssues(s)).toEqual([]);
  });

  it('says which venue sets a shared kitchen’s screens', () => {
    const a = venue({ id: 'a' });
    const b = venue({ id: 'b' });
    const s = { ...base, venues: [a, b] };
    expect(kitchenOf(s, b)?.owner.id).toBe('a');
    expect(kitchenOf(s, venue({ room: null }))).toBeNull();
  });
});
