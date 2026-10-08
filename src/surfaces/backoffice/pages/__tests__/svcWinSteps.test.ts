import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type DiningConfig } from '../../../../domain/config';
import type { WindowSettings } from '../../../../domain/pickupService/windows';
import { andList, everywhereSummary, incompleteSteps, setupIssues, spansText, venueOffers, venueSummary, type SetupInput } from '../svcWinSteps';

const input = (win: WindowSettings = {}, cfg: Partial<DiningConfig> = {}, lead = 20): SetupInput => ({
  win,
  cfg: { ...DEFAULT_CONFIG, ...cfg },
  community: 'Test',
  lead,
  venues: ['sequoia', 'bistro'],
});

describe('Pick Up & Delivery setup', () => {
  it('lists words and spans plainly', () => {
    expect(andList(['a'])).toBe('a');
    expect(andList(['a', 'b', 'c'])).toBe('a, b and c');
    expect(spansText([690, 705, 720, 735, 750, 765])).toBe('11:30 AM – 1:00 PM');
    expect(spansText([1020, 1035, 1080])).toBe('5:00 – 5:30 PM, 6:00 – 6:15 PM');
  });

  it('knows which types a venue offers from its ranges', () => {
    expect(venueOffers({}, 'sequoia')).toEqual({ pickup: true, assoc: true, delivery: true });
    expect(venueOffers({ grid: { bistro: { delivery: [], assoc: [], noc: [] } } }, 'bistro')).toEqual({
      pickup: true,
      assoc: false,
      delivery: false,
    });
  });

  it('finds nothing to fix in the defaults', () => {
    expect(setupIssues(input())).toEqual([]);
  });

  it('flags the steps that look unfinished', () => {
    const none = { grid: { sequoia: { pickup: [], delivery: [] }, bistro: { pickup: [], delivery: [] } } };
    expect([...incompleteSteps(input(none))]).toEqual(['types', 'ranges']);
    // Delivery off for ranges (as soon as it is ready) is not a missing range.
    expect(setupIssues(input({ ...none, types: { pickup: { on: false }, delivery: { on: false } } })).map((x) => x.step)).toEqual(['types']);
    expect(setupIssues(input({ cap: { bistro: { total: 4, delivery: 6 } } }))).toEqual([
      { step: 'capacity', text: 'The Bistro: delivery allows 6, but the total per range is 4.' },
    ]);
    expect(setupIssues(input({ cut: 10 }, {}, 20))).toEqual([
      { step: 'timing', text: 'Orders close 10 min before a range, but the kitchen fires 20 min before.' },
    ]);
    expect([...incompleteSteps(input({}, { sick: { Test: { on: true, allow: 0 } } }))]).toEqual(['fees']);
  });

  it('sums up a venue in plain words', () => {
    const win: WindowSettings = {
      grid: { sequoia: { pickup: [690, 705, 720, 735, 750, 765], delivery: [690, 705, 720, 735, 750, 765], assoc: [], noc: [] } },
      cap: { sequoia: { total: 6 } },
    };
    const sum = venueSummary(input(win, { fees: { sequoia: { delivery: 3, pickup: 0 } } }), 'sequoia');
    expect(sum.name).toBe('Sequoia / Evergreen');
    expect(sum.lines).toEqual([
      { step: 'types', text: 'Resident pick up and delivery' },
      { step: 'ranges', text: 'Resident pick up and delivery: lunch 11:30 AM – 1:00 PM, every 15 min' },
      { step: 'capacity', text: '6 per range' },
      { step: 'fees', text: 'Delivery $3.00, pick up free' },
    ]);
  });

  it('says when a type is as soon as it is ready, and when nothing is offered', () => {
    const win: WindowSettings = { types: { delivery: { on: false } }, grid: { bistro: { assoc: [], noc: [] } } };
    const lines = venueSummary(input(win), 'bistro').lines;
    expect(lines[0].text).toBe('Resident pick up and delivery (delivery as soon as it is ready)');
    expect(lines.filter((l) => l.step === 'ranges').map((l) => l.text.split(':')[0])).toEqual(['Resident pick up']);
    const off = { grid: { bistro: { pickup: [], delivery: [], assoc: [], noc: [] } } };
    expect(venueSummary(input(off), 'bistro').lines).toEqual([{ step: 'types', text: 'No pick up or delivery' }]);
  });

  it('sums up what every venue shares', () => {
    expect(everywhereSummary(input({ cut: 30 }, { flow: { freeDeliveryComp: false }, sick: { Test: { on: true, allow: 2 } } }, 15))).toEqual([
      { step: 'timing', text: 'Order 30 min ahead, kitchen fires 15 min before, NOC meals made by 8:00 PM' },
      { step: 'fees', text: 'Sick waivers: 2 per resident a month, hospice delivery charged' },
    ]);
  });
});
