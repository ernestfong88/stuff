/**
 * Inputs for the Culinary Dashboard's history, extracted from the prototype:
 * the servers on its service history, the dishes residents comment on (with
 * how well each is liked and its usual complaint), comment wording, and the
 * dish ratings residents gave on the tablets today.
 */
import { staff } from '../../../data';
import dashboardJson from './dashboard.json';

export type FeedbackSentiment = 'pos' | 'neu' | 'neg';
/** The usual complaint for a dish that draws them; picks the comment wording. */
export type ComplaintKind = 'dry' | 'salt' | 'cold' | 'bland' | 'tough';

export interface FeedbackDish {
  name: string;
  /** Day of the menu cycle it is served. */
  cycleDay: number;
  meal: 'L' | 'D';
  /** Share of comments that are positive. */
  liked: number;
  /** Comments seeded the last time it ran. */
  count: number;
  complaint?: ComplaintKind;
}

export interface DishRating {
  id: string;
  residentId: string;
  verdict: 'Liked' | 'Disliked' | 'Okay';
  sub: string | null;
  dish: string | null;
  minutesAgo: number;
}

const seed = dashboardJson as unknown as {
  servers: Array<{ id: string; name: string }>;
  feedbackDishes: Array<[string, number, 'L' | 'D', number, number, ComplaintKind?]>;
  feedbackTemplates: Record<FeedbackSentiment | ComplaintKind, string[]>;
  cycleDay: number;
  ratings: DishRating[];
  specialsMade: Record<string, number>;
  specialsSoldEarlier: Record<string, number>;
};

/**
 * Servers on the service history. Staff who are on the dining roster use
 * their roster name, so a person reads the same everywhere.
 */
export const HISTORY_SERVERS: Array<{ id: string; name: string }> = seed.servers.map((x) => ({ id: x.id, name: staff.find((s) => s.id === x.id)?.name ?? x.name }));

export const FEEDBACK_DISHES: FeedbackDish[] = seed.feedbackDishes.map(([name, cycleDay, meal, liked, count, complaint]) => ({ name, cycleDay, meal, liked, count, complaint }));
export const FEEDBACK_TEMPLATES = seed.feedbackTemplates;
/** Today's day in the menu cycle (dishes served on later cycle days last ran a cycle ago). */
export const CYCLE_DAY = seed.cycleDay;
export const TODAYS_RATINGS: DishRating[] = seed.ratings;

/** Today's production count for each special (menu item id). */
export const SPECIALS_MADE: Record<string, number> = seed.specialsMade;
/** Specials sold in the dining room before the floor's live checks begin. */
export const SPECIALS_SOLD_EARLIER: Record<string, number> = seed.specialsSoldEarlier;
