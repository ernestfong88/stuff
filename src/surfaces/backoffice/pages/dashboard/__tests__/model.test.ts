import { describe, expect, it } from 'vitest';
import { residents } from '../../../../../data';
import { HISTORY_SERVERS } from '../../../seed/dashboard';
import { countSentiment, feedbackHistory, matchDish, readComment, sentimentOf, sentimentTrend } from '../model/feedback';
import { currentDays, dayLabel, period } from '../model/periods';
import { budgetPct, compsFor, revenuePeriod } from '../model/revenue';
import { avgTableTime, lateTablesByServer, serviceAction, timedTables } from '../model/service';

// A Wednesday; the prototype showed these same numbers for this day.
const TODAY = new Date(2026, 9, 7).getTime();
const days7 = currentDays(7, TODAY).map((d) => d.a);

describe('periods', () => {
  it('ends the current period today and steps back whole periods', () => {
    const p0 = period(0, 7, TODAY);
    expect(new Date(p0.a).getDate()).toBe(1);
    expect(new Date(p0.b).getDate()).toBe(8);
    expect(new Date(period(1, 7, TODAY).a).getDate()).toBe(24);
  });
  it('labels weekdays for a week and thins the axis for longer ranges', () => {
    const d = currentDays(7, TODAY);
    expect(d.map((x) => dayLabel(x, 7))).toEqual(['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today']);
    const labels = currentDays(28, TODAY).map((x) => dayLabel(x, 28));
    expect(labels.filter(Boolean)).toEqual(['9/16', '9/23', '9/30', 'Today']);
  });
});

describe('steps of service', () => {
  it('times the same tables for a day every time', () => {
    expect(timedTables(TODAY, HISTORY_SERVERS)).toEqual(timedTables(TODAY, HISTORY_SERVERS));
  });
  it('averages table time per day and over the week', () => {
    const per = days7.map((d) => avgTableTime(timedTables(d, HISTORY_SERVERS))!.toFixed(1));
    expect(per).toEqual(['26.8', '24.6', '25.4', '19.2', '20.1', '18.6', '21.8']);
    expect(avgTableTime(days7.flatMap((d) => timedTables(d, HISTORY_SERVERS)))!.toFixed(1)).toBe('22.3');
  });
  it('points the top action at the slowest meal and server', () => {
    const a = serviceAction(days7.flatMap((d) => timedTables(d, HISTORY_SERVERS)));
    expect(a?.text).toMatch(/^Coach Ricardo Juarez and the line on dinner entrée pacing\./);
  });
  it('groups late tables by server, most late first', () => {
    const groups = lateTablesByServer(timedTables(TODAY, HISTORY_SERVERS));
    for (let i = 1; i < groups.length; i++) expect(groups[i - 1].late.length).toBeGreaterThanOrEqual(groups[i].late.length);
    for (const g of groups) expect(g.late.every((t) => t.app + t.ent > 22)).toBe(true);
  });
});

describe('revenue', () => {
  it('adds up the week', () => {
    const p = revenuePeriod(days7);
    expect(p.made).toBe(1554);
    expect(p.comp).toBe(57);
    expect(p.budget).toBe(2350);
    expect(budgetPct(p.made, p.budget)).toBe(66);
  });
  it('splits a day’s comps so they add up to its total', () => {
    const p = revenuePeriod(days7);
    for (const d of p.days) {
      const comps = compsFor(d, HISTORY_SERVERS, ['A', 'B']);
      expect(comps.reduce((q, c) => q + c.amount, 0)).toBe(d.comp);
    }
  });
  it('never shows 100% of budget while behind', () => {
    expect(budgetPct(999, 1000)).toBe(99);
    expect(budgetPct(1000, 1000)).toBe(100);
  });
});

describe('feedback', () => {
  const past = feedbackHistory(residents, TODAY);
  it('generates the same history every time', () => {
    expect(feedbackHistory(residents, TODAY)).toEqual(past);
  });
  it('reads a complaint over praise in one sentence', () => {
    expect(sentimentOf('Loved it but it was cold')).toBe('neg');
    expect(sentimentOf('Loved the peach glazed chicken')).toBe('pos');
    expect(sentimentOf('Had the soup')).toBe('neu');
  });
  it('does not read a dish name as a complaint', () => {
    const c = readComment({ id: 'x', at: 0, dish: 'Slow Roasted Prime Rib', text: 'Loved the Slow Roasted Prime Rib.', sent: 'pos', who: '', src: 'Voice note' });
    expect(c.themes).toEqual([]);
    expect(c.pos).toBe(true);
  });
  it('links a comment to the dish it names, preferring what was on the check', () => {
    expect(matchDish('The cheeseburger soup was too salty', [], ['Cheeseburger Soup', 'Classic Terrace Burger'])).toBe('Cheeseburger Soup');
    expect(matchDish('Her chicken came out cold', ['Peach Glazed Chicken Breast'], ['Chicken Marsala'])).toBe('Peach Glazed Chicken Breast');
    expect(matchDish('Nice evening', [], ['Chicken Marsala'])).toBeNull();
  });
  it('compares net sentiment with the period before', () => {
    expect(sentimentTrend({ pos: 8, neu: 1, neg: 1, n: 10 }, { pos: 5, neu: 1, neg: 4, n: 10 })).toBe('up');
    expect(sentimentTrend({ pos: 5, neu: 1, neg: 4, n: 10 }, { pos: 5, neu: 1, neg: 4, n: 10 })).toBe('flat');
    expect(sentimentTrend(countSentiment([]), { pos: 1, neu: 0, neg: 0, n: 1 })).toBe('none');
  });
});
