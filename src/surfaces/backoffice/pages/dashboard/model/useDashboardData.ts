import { useMemo } from 'react';
import { catalog, getItem, getResident, residents } from '../../../../../data';
import type { Order, ResidentNote } from '../../../../../domain/types';
import { MINUTE, now, startOfToday } from '../../../../../lib/clock';
import { useNotes } from '../../../../../store/notes';
import { useDiningHistory, useDiningOrders } from '../../../../../store/dining';
import { FEEDBACK_DISHES, HISTORY_SERVERS, TODAYS_RATINGS } from '../../../seed/dashboard';
import { countSentiment, feedbackHistory, matchDish, ratingFeedback, sentimentOf, type FeedbackItem, type SentimentCount } from './feedback';
import { addDays, currentDays, period, type DaySlot, type RangeDays } from './periods';
import { compsFor, revenuePeriod, type Comp, type RevenuePeriod } from './revenue';
import { timedTables, type TimedTable } from './service';
import type { SentimentDay } from './sentiment';

const KNOWN_DISHES = [...new Set([...FEEDBACK_DISHES.map((d) => d.name), ...catalog.map((c) => c.name)])];
const RESIDENT_NAMES = residents.map((r) => r.name);

/** What the resident ate today, for linking a comment to its dish. */
function dishesOnChecks(rid: string, checks: Order[]): string[] {
  const names = new Set<string>();
  for (const o of checks)
    for (const d of o.diners)
      if (d.kind === 'resident' && !d.isGuest && d.refId === rid)
        for (const l of d.items) {
          const it = l.cancelled ? undefined : getItem(l.itemId);
          if (it) names.add(it.name);
        }
  return [...names];
}

/** Today's comments: notes servers took (voice or quick feedback) and dish ratings. */
export function todaysFeedback(notes: ResidentNote[], checks: Order[], at: number, todayStart: number): FeedbackItem[] {
  const fromNotes = notes
    .filter((x) => x.kind === 'fb' && x.at >= todayStart)
    .map((x): FeedbackItem => {
      const quick = x.src === 'tap';
      return {
        id: x.id,
        at: x.at,
        dish: matchDish(x.text, dishesOnChecks(x.rid, checks), KNOWN_DISHES),
        text: x.text,
        sent: sentimentOf(x.text),
        who: getResident(x.rid)?.name ?? '',
        by: x.by,
        where: x.table,
        src: quick ? 'Quick feedback' : 'Voice note',
      };
    });
  const ratings = TODAYS_RATINGS.map((r) => ratingFeedback(r, getResident(r.residentId)?.name ?? '', at - r.minutesAgo * MINUTE));
  return [...fromNotes, ...ratings].sort((a, b) => b.at - a.at);
}

export interface DashboardData {
  n: RangeDays;
  todayStart: number;
  days: DaySlot[];
  /** Comments per day of the current range. */
  sentimentDays: SentimentDay[];
  /** Comment counts for the 8 periods, oldest first. */
  sentimentPeriods: SentimentCount[];
  /** Tables timed in the 8 periods, oldest first. */
  servicePeriods: TimedTable[][];
  revenuePeriods: RevenuePeriod[];
  /** Comps in the current range. */
  comps: Comp[];
  compsByDay: Comp[][];
  /** Comments for each of the last 7 days, today first (whatever the range). */
  recentFeedback: SentimentDay[];
}

const dayStarts = (a: number, n: number) => {
  const out: number[] = [];
  const d = new Date(a);
  for (let i = 0; i < n; i++) {
    out.push(d.getTime());
    d.setDate(d.getDate() + 1);
  }
  return out;
};

/** Everything the dashboard cards and their details read, for the last `n` days. */
export function useDashboardData(n: RangeDays): DashboardData {
  const notes = useNotes();
  const orders = useDiningOrders();
  const history = useDiningHistory();
  const todayStart = startOfToday();
  const past = useMemo(() => feedbackHistory(residents, todayStart), [todayStart]);
  const today = useMemo(() => todaysFeedback(notes, [...orders, ...history], now(), todayStart), [notes, orders, history, todayStart]);

  return useMemo(() => {
    const all = [...past, ...today];
    const days = currentDays(n, todayStart);
    const ranges = Array.from({ length: 8 }, (_, i) => period(7 - i, n, todayStart));
    const inRange = (a: number, b: number) => all.filter((f) => f.at >= a && f.at < b);
    const sentimentDays: SentimentDay[] = days.map((d) => {
      const items = d.today ? today : past.filter((f) => addDays(f.at, 0) === d.a);
      return { a: d.a, today: d.today, items, count: countSentiment(items) };
    });
    const servicePeriods = ranges.map((p) => dayStarts(p.a, n).flatMap((day) => timedTables(day, HISTORY_SERVERS)));
    const revenuePeriods = ranges.map((p) => revenuePeriod(dayStarts(p.a, n)));
    const cur = revenuePeriods[7];
    const compsByDay = cur.days.map((d) => compsFor(d, HISTORY_SERVERS, RESIDENT_NAMES));
    return {
      n,
      todayStart,
      days,
      sentimentDays,
      sentimentPeriods: ranges.map((p) => countSentiment(inRange(p.a, p.b))),
      servicePeriods,
      revenuePeriods,
      comps: compsByDay.flat(),
      compsByDay,
      recentFeedback: currentDays(7, todayStart)
        .reverse()
        .map((d) => {
          const items = d.today ? today : past.filter((f) => addDays(f.at, 0) === d.a);
          return { a: d.a, today: d.today, items, count: countSentiment(items) };
        }),
    };
  }, [n, todayStart, past, today]);
}
