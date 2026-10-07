import { describe, expect, it } from 'vitest';
import type { Diner, Order, ResidentNote } from '../../../../domain/types';
import { closedThisShift, paymentOf, shiftTotals } from '../shift/closedChecks';
import { matchDish, sentimentOf, summarizeFeedback, type FeedbackItem } from '../shared/feedback';
import { noteRank } from '../points/noteRank';
import { appendPreference, withoutPreference } from '../voice/saveHeard';
import { littleThings } from '../residents/littleThings';
import { searchResidents, planTill } from '../residents/residentInfo';
import { menuSections, mealAt } from '../menu/menuSections';
import { conversationStarters, originalStory } from '../../../../store/residentStories';
import { residents } from '../../../../data';

const diner = (p: Partial<Diner>): Diner => ({ id: 'd', kind: 'resident', refId: 'r1', isGuest: false, seat: 1, items: [], ...p });
const order = (p: Partial<Order>): Order => ({ id: 'o', room: 'sequoia', server: 'AA', meal: 'Dinner', openedAt: 0, diners: [], ...p });

describe('payments at close', () => {
  it('reads card, apartment and comp drops', () => {
    const o = order({});
    expect(paymentOf(diner({ chargeDrop: 'card:34:sq_7F3K2' }), o)).toMatchObject({ kind: 'card', amt: 34, ref: 'sq_7F3K2' });
    expect(paymentOf(diner({ chargeDrop: 'apt:18' }), o)).toMatchObject({ kind: 'apt', amt: 18 });
    expect(paymentOf(diner({ chargeDrop: 'comp:Sick:22' }), o)).toMatchObject({ kind: 'comp', reason: 'Sick', amt: 22 });
    expect(paymentOf(diner({ chargeDrop: 'plan' }), o)).toEqual({ kind: 'plan' });
    expect(paymentOf(diner({ chargeDrop: null }), o)).toEqual({ kind: 'plan' });
  });

  it("totals a server's checks closed this shift", () => {
    const history = [
      order({ id: 'a', closedAt: 100, diners: [diner({ chargeDrop: 'card:10' }), diner({ chargeDrop: 'plan' })] }),
      order({ id: 'b', closedAt: 200, diners: [diner({ chargeDrop: 'comp:Sick:5' })] }),
      order({ id: 'c', closedAt: 50, diners: [diner({})] }),
      order({ id: 'd', server: 'RJ', closedAt: 300, diners: [diner({})] }),
    ];
    const rows = closedThisShift(history, 'AA', 60);
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
    const t = shiftTotals(rows);
    expect(t).toMatchObject({ checks: 2, covers: 3, card: { sum: 10, count: 1 }, comps: { sum: 5, count: 1 } });
  });
});

describe('dining feedback', () => {
  it('reads sentiment', () => {
    expect(sentimentOf('The soup was too salty.')).toBe('neg');
    expect(sentimentOf('Loved the trifle.')).toBe('pos');
    expect(sentimentOf('Asked about the menu.')).toBe('neu');
  });

  it('ties a comment to a dish on the menu', () => {
    expect(matchDish('Said the peach glazed chicken tonight was fantastic.', 'r1', [])?.name).toBe('Peach Glazed Chicken Breast');
  });

  it('sums up concerns and what went well', () => {
    const item = (id: string, text: string, dish: string | null, who = 'A B'): FeedbackItem => ({ id, who, text, at: 0, source: 'Voice note', dish });
    const sum = summarizeFeedback([
      item('1', 'The soup was too salty.', 'Cheeseburger Soup', 'Ann B'),
      item('2', 'Salty soup again.', 'Cheeseburger Soup', 'Cy D'),
      item('3', 'Loved the trifle.', 'Pineapple Trifle', 'Ed F'),
      item('4', 'Could we bring back the pot roast?', null, 'Gi H'),
    ]);
    expect(sum.issues[0]).toMatchObject({ key: 'salt', n: 2, dishes: ['Cheeseburger Soup'] });
    expect(sum.liked[0]).toEqual(['Pineapple Trifle', 1]);
    expect(sum.asks).toHaveLength(1);
    expect(sum.head).toContain('4 comments from 4 residents');
    expect(sum.todo[0]).toContain('Taste the Cheeseburger Soup for salt');
  });
});

describe('notes and preferences', () => {
  const note = (p: Partial<ResidentNote>): ResidentNote => ({ id: 'n', kind: 'know', rid: 'r1', text: 'x', at: 0, ...p });

  it('ranks servers by points with ties sharing the better place', () => {
    const r = noteRank([note({ by: 'AA' }), note({ by: 'RJ' }), note({ by: 'RJ' })], 'AA', ['MG']);
    expect(r).toMatchObject({ mine: 1, of: 3, rank: 2 });
    expect(noteRank([], 'AA', ['RJ']).rank).toBe(1);
  });

  it('adds and removes preference text cleanly', () => {
    expect(appendPreference('Tea, no sugar.', 'Decaf with dinner.')).toBe('Tea, no sugar. Decaf with dinner.');
    expect(appendPreference('', 'Decaf.')).toBe('Decaf.');
    expect(withoutPreference('Tea, no sugar. Decaf with dinner.', 'Decaf with dinner.')).toBe('Tea, no sugar.');
    expect(withoutPreference('Tea. Decaf.', 'Decaf.', 'Hot tea.')).toBe('Tea. Hot tea.');
  });

  it("keeps Good to know to little things, newest first, each once", () => {
    const things = littleThings(
      [note({ text: 'Old news', at: 1 }), note({ text: 'New news', at: 2 }), note({ kind: 'obs', text: 'Seemed tired', at: 3 })],
      ['From the profile', 'new news'],
    );
    expect(things.map((t) => t.text)).toEqual(['New news', 'Old news', 'From the profile']);
  });
});

describe('residents', () => {
  it('finds the exact apartment first, then names', () => {
    expect(searchResidents(residents, '153').map((r) => r.id)).toEqual(['r1b', 'r1']);
    expect(searchResidents(residents, 'mart')[0].name).toMatch(/Martin/);
    expect(searchResidents(residents, 'zzz')).toEqual([]);
  });

  it('says when the plan resets', () => {
    expect(planTill({ plan: 'monthly30', consumed: 18 }, new Date(2026, 9, 7))).toBe('12 meals till 11/1');
    expect(planTill({ plan: 'daily2', consumed: 1 }, new Date(2026, 9, 7))).toBe('1 meal till 10/8');
    expect(planTill({ plan: 'alacarte', consumed: 0 }, new Date(2026, 9, 7))).toBeNull();
  });

  it('always has a conversation starter when there is family on file', () => {
    expect(conversationStarters(originalStory('r1'), { contacts: [] })[0]).toBe('How is Tyler liking Arizona State so far?');
    expect(conversationStarters(originalStory('nobody'), { contacts: [{ name: 'Sam Lee', rel: 'Son' }] })).toEqual(['How is your son Sam doing?']);
  });
});

describe('menu reference', () => {
  it('lists dishes once, specials first, without drinks or add-ons', () => {
    const m = menuSections('Dinner');
    expect(m.specials.length).toBeGreaterThan(0);
    expect(m.specials[0].entree).toBe(true);
    expect(m.categories.some((c) => /drinks|add-?ons|cocktails|alcohol/i.test(c.name))).toBe(false);
    expect(new Set(m.all.map((i) => i.id)).size).toBe(m.all.length);
  });

  it('knows which meal is on', () => {
    expect(mealAt(8)).toBe('Breakfast');
    expect(mealAt(12)).toBe('Lunch');
    expect(mealAt(18)).toBe('Dinner');
  });
});
