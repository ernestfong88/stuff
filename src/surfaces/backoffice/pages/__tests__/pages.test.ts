import { describe, expect, it } from 'vitest';
import { residents } from '../../../../data';
import { DEFAULT_CONFIG } from '../../../../domain/config';
import type { Order } from '../../../../domain/types';
import type { Charge } from '../../seed/billing';
import { ADP_ASSOCIATES } from '../../seed/associates';
import { PMIX_DAYS, PMIX_RECIPES, PMIX_SIDES } from '../../seed/pmix';
import { addedText, currentPin, filterAssociates, isGuessable, newPin } from '../access/pins';
import { approveAll, chargesFor, toggleApproval } from '../chargeReview/charges';
import { attentionItems } from '../dashboard/model/attention';
import { countSpecial } from '../dashboard/model/specials';
import { waiverUseByResident, waiverUseText } from '../fees/sickWaivers';
import { duplicateNames } from '../mealdrops/duplicates';
import { buildRows, feedbackTag, filterRows } from '../orders/orderRows';
import { mixFor, visibleItems } from '../pmix/mix';
import { guestCreditOn, mealCreditText, DEFAULT_MEAL_CREDIT } from '../../../../domain/config';
import { dietRows, filterDietRows, tagCounts } from '../resDiets/diets';

const DAY = 86_400_000;

describe('charge approval', () => {
  const base: Charge = { id: 'a', residentId: 'r1', level: 'IL', date: 10 * DAY, item: 'TRAY', desc: '', amount: 5, active: true, approvedAt: null, approvedBy: null, importedAt: null, source: 'delivery' };
  const list: Charge[] = [base, { ...base, id: 'b', approvedAt: 1, approvedBy: 'X' }, { ...base, id: 'c', approvedAt: 1, active: false }, { ...base, id: 'd', importedAt: 2, approvedAt: 1, date: 0 }];
  it('lists each step on its own tab', () => {
    expect(chargesFor('review', list, 70 * DAY).map((c) => c.id)).toEqual(['a']);
    expect(chargesFor('final', list, 70 * DAY).map((c) => c.id)).toEqual(['b']);
    expect(chargesFor('recent', list, 70 * DAY).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
  it('approves and takes back an approval', () => {
    const on = toggleApproval(base, 'E. Fong', 5);
    expect(on).toMatchObject({ approvedAt: 5, approvedBy: 'E. Fong' });
    expect(toggleApproval(on, 'E. Fong', 6)).toMatchObject({ approvedAt: null, approvedBy: null });
  });
  it('approves every live charge waiting, never a voided one', () => {
    const out = approveAll([base, { ...base, id: 'v', active: false }], 'E. Fong', 9);
    expect(out[0].approvedAt).toBe(9);
    expect(out[1].approvedAt).toBeNull();
  });
});

describe('meal counts', () => {
  it('finds the same option typed twice', () => {
    expect(duplicateNames(['A la Carte', 'Ala Carte', '1 Meal Count'])).toEqual([['A la Carte', 'Ala Carte']]);
    expect(duplicateNames(['One', 'Two'])).toEqual([]);
  });
});

describe('guest meal credits', () => {
  it('is on at The Fountains unless switched off', () => {
    expect(guestCreditOn(DEFAULT_CONFIG, 'The Fountains')).toBe(true);
    expect(guestCreditOn(DEFAULT_CONFIG, 'Valencia Terrace')).toBe(false);
    const cfg = { ...DEFAULT_CONFIG, guestCredit: { 'The Fountains': false, 'Valencia Terrace': true } };
    expect([guestCreditOn(cfg, 'The Fountains'), guestCreditOn(cfg, 'Valencia Terrace')]).toEqual([false, true]);
  });

  it('describes what one credit covers', () => {
    expect(mealCreditText(DEFAULT_MEAL_CREDIT)).toBe('1 starter + 1 entrée + 2 sides + 1 dessert per credit · a 3rd side and added proteins are à la carte · side swaps are free');
    expect(mealCreditText({ ...DEFAULT_MEAL_CREDIT, starters: 0, sides: 3, extraSidesAla: false })).toBe('1 entrée + 3 sides + 1 dessert per credit · added proteins are à la carte · side swaps are free');
  });
});

describe('sick waivers', () => {
  const w = (rid: string, id: string) => ({ id, ref: id, at: 0, meal: 'Dinner', queueType: 'delivery' as const, sickTray: { rid, n: 0, by: 'A', at: 0 } });
  it('counts per resident, most used first', () => {
    const rows = waiverUseByResident([w('r9', '1'), w('r9', '2'), w('r9', '3'), w('r8', '4')], 3, (rid) => ({ r9: 'Harold', r8: 'Mildred' })[rid]);
    expect(rows.map((r) => [r.rid, r.used, r.allUsed])).toEqual([
      ['r9', 3, true],
      ['r8', 1, false],
    ]);
    expect(waiverUseText({ used: 4 }, 3)).toBe('4 used, limit 3');
    expect(waiverUseText({ used: 2 }, 3)).toBe('2 of 3 used');
  });
});

describe('order history', () => {
  const order = (id: string, patch: Partial<Order>): Order => ({
    id,
    room: 'sequoia',
    server: 'AA',
    meal: 'Dinner',
    openedAt: 1,
    diners: [{ id: id + 'd', kind: 'resident', refId: 'r1', isGuest: false, seat: 1, items: [] }],
    ...patch,
  });
  it('reads feedback either way it was saved', () => {
    expect(feedbackTag({ verdict: 'Disliked', sub: 'Temp' })).toEqual({ text: 'Disliked · Temp', tone: 'danger' });
    expect(feedbackTag('Liked')?.tone).toBe('success');
    expect(feedbackTag(null)).toBeNull();
  });
  it('totals what was charged and filters by charge type', () => {
    const closed = [
      order('apt', { closedAt: 5, diners: [{ id: 'x', kind: 'resident', refId: 'r1', isGuest: false, seat: 1, items: [], chargeDrop: 'apt', chargeAmt: 3 }] }),
      order('card', { closedAt: 6, diners: [{ id: 'y', kind: 'resident', refId: 'r2', isGuest: false, seat: 1, items: [], chargeDrop: 'card', chargeAmt: 17 }] }),
    ];
    const rows = buildRows([order('open', { openedAt: 7 })], closed, DEFAULT_CONFIG);
    expect(rows.map((r) => r.order.id)).toEqual(['open', 'card', 'apt']);
    expect(filterRows(rows, { query: '', server: 'All', charge: 'apt' }).map((r) => r.charged)).toEqual([3]);
    expect(filterRows(rows, { query: '', server: 'All', charge: 'other' }).map((r) => r.charged)).toEqual([17]);
    expect(filterRows(rows, { query: 'eleanor', server: 'All', charge: 'All' }).map((r) => r.order.id)).toEqual(['card']);
  });
});

describe('allergies and diets', () => {
  const rows = dietRows(residents);
  it('tags textures apart from diets', () => {
    const frank = rows.find((x) => x.r.name === 'Frank Dellacroce')!;
    expect(frank.tags).toEqual([
      { text: 'Puree', cat: 'texture' },
      { text: 'Nectar thick', cat: 'texture' },
    ]);
    expect(tagCounts(rows)[0].cat).toBe('allergy');
  });
  it('filters by category, tag and search, and hides people with nothing on file', () => {
    const f = { query: '', cat: 'all' as const, tag: null, includeNone: false, sort: { key: 'name' as const, dir: 1 as const } };
    expect(filterDietRows(rows, f)).toHaveLength(8);
    expect(filterDietRows(rows, { ...f, includeNone: true })).toHaveLength(residents.length);
    expect(filterDietRows(rows, { ...f, cat: 'allergy' })).toHaveLength(4);
    expect(filterDietRows(rows, { ...f, tag: 'allergy|Gluten' }).map((x) => x.r.name)).toEqual(['Beatrice Sanderson', 'Mildred Vanholder']);
    expect(filterDietRows(rows, { ...f, query: 'mussels' }).map((x) => x.r.name)).toEqual(['Rose Delgado']);
    expect(filterDietRows(rows, { ...f, sort: { key: 'apt', dir: -1 } })[0].r.apt).toBe('412');
  });
});

describe('associates and PINs', () => {
  it('makes a new PIN no one has and no one could guess', () => {
    const seq = [0.1234, 0.0, 0.5];
    let i = 0;
    const pin = newPin(new Set(['2110']), () => seq[i++]);
    // 0.1234 → 2110 (taken), 0 → 1000 (fine).
    expect(pin).toBe('1000');
    expect(isGuessable('1111')).toBe(true);
    expect(isGuessable('2345')).toBe(true);
    expect(isGuessable('8642')).toBe(false);
  });
  it('uses a reset PIN over the roster', () => {
    const aa = ADP_ASSOCIATES.find((a) => a.id === 'AA')!;
    expect(currentPin(aa, {})).toBe('2468');
    expect(currentPin(aa, { AA: '9999' })).toBe('9999');
    expect(currentPin(ADP_ASSOCIATES.find((a) => a.id === 'EF')!, {})).toBeUndefined();
  });
  it('filters by sign in and search', () => {
    const sort = { key: 'name' as const, dir: 1 as const };
    expect(filterAssociates(ADP_ASSOCIATES, { query: '', how: 'win', sort })).toHaveLength(4);
    expect(filterAssociates(ADP_ASSOCIATES, { query: 'line cook', how: 'all', sort }).map((a) => a.id)).toEqual(['GK', 'TR']);
  });
  it('says how long ago an account came over', () => {
    expect(addedText(0, 0)).toBe('Today');
    expect(addedText(5, 0)).toBe('5 days ago');
  });
});

describe('p-mix', () => {
  it('sums yesterday the way the prototype showed it', () => {
    const mix = mixFor(PMIX_DAYS, PMIX_RECIPES, PMIX_SIDES, { fromBack: 1, toBack: 1, meal: 'All', venue: 'All' });
    const items = visibleItems(mix.items, 'All', '');
    expect(items.reduce((q, x) => q + x.sp, 0)).toBe(450);
    expect(items.reduce((q, x) => q + x.al, 0)).toBe(956);
  });
  it('limits by meal, venue and protein', () => {
    const all = mixFor(PMIX_DAYS, PMIX_RECIPES, PMIX_SIDES, { fromBack: 7, toBack: 1, meal: 'All', venue: 'All' });
    const dinner = mixFor(PMIX_DAYS, PMIX_RECIPES, PMIX_SIDES, { fromBack: 7, toBack: 1, meal: 'Dinner', venue: 'All' });
    expect(dinner.tot).toBeLessThan(all.tot);
    expect(all.days).toBe(7);
    expect(visibleItems(all.items, 'All', 'beef').every((x) => x.r.cat === 'Entrees' && x.r.protein === 'beef')).toBe(true);
  });
});

describe('dashboard attention', () => {
  const base = { out: [], lateTickets: 0, lateMinutes: 20, waiversUsedUp: [], chargesToReview: 0, amountToReview: 0, venues: [], menus: [], at: 0 };
  it('shows nothing when all is well', () => {
    expect(attentionItems(base)).toEqual([]);
  });
  it('words each card for one or many and links where to act', () => {
    const items = attentionItems({ ...base, chargesToReview: 5, amountToReview: 70, venues: [{ id: 'v', name: 'Catering', active: true, menuId: null, upcoming: [] }] });
    expect(items.map((i) => [i.title, i.goto?.page])).toEqual([
      ['charges to review', 'chargeReview'],
      ['venue has no menu', 'menus'],
    ]);
    expect(items[0].detail).toBe('$70.00 waiting for approval before billing.');
  });
});

describe('specials made and ordered', () => {
  it('counts sent lines, pick up apart from the dining room, and associate meals', () => {
    const line = (itemId: string, extra = {}) => ({ id: itemId, itemId, mods: {}, note: '', sent: true, kitchenState: null, ...extra });
    const checks: Order[] = [
      { id: '1', room: 'sequoia', server: 'AA', meal: 'Dinner', openedAt: 10, diners: [{ id: 'd', kind: 'resident', refId: 'r1', isGuest: false, seat: 1, items: [line('d_peach'), line('d_peach', { cancelled: true })] }] },
      { id: '2', room: 'sequoia', server: 'AA', meal: 'Dinner', openedAt: 10, queueType: 'delivery', diners: [{ id: 'e', kind: 'resident', refId: 'r2', isGuest: false, seat: 1, items: [line('d_peach')] }] },
    ];
    const assoc = [{ id: 'a', date: '2026-10-07', meal: 'Dinner', window: '', associate: 'x', item: 'Peach Glazed Chicken Breast', status: 'Placed', note: '', log: [] }];
    const c = countSpecial({ id: 'd_peach', name: 'Peach Glazed Chicken Breast', meals: 'Dinner', category: 'Entrées' }, checks, assoc, { todayStart: 0, todayIso: '2026-10-07', made: 40, earlier: 12 });
    expect(c).toEqual({ made: 40, dine: 13, pickupDelivery: 1, associates: 1, total: 15, left: 25 });
  });
});
