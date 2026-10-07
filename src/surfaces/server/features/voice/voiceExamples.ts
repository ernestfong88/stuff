/**
 * Example things a server might say about a resident, offered under "Try
 * an example" so the feature can be tried without a microphone, and so new
 * servers see what is worth mentioning. Residents without a written example
 * get one built from what is on their own check.
 */
import { getItem } from '../../../../data';
import { isDrink } from '../../../../domain/menu';
import type { Order, Resident } from '../../../../domain/types';
import { seedHash } from '../../../../store/trivia';

export interface VoiceSample {
  said: string;
  /** How the example was sorted when it was written (kept for reference in tests). */
  heard: Array<['know' | 'obs' | 'pref' | 'fb', string]>;
}

const SAMPLES: Record<string, VoiceSample> = {
  r1: {
    said:
      "Marty says his grandson made the dean's list. He had a hard time hearing me over the music, I repeated the specials twice. He said the peach glazed chicken tonight was fantastic. And he wants decaf with dinner from now on.",
    heard: [
      ['know', "Grandson Tyler made the dean's list."],
      ['obs', 'Had trouble hearing over the dining room music.'],
      ['fb', 'Said the peach glazed chicken tonight was fantastic.'],
      ['pref', 'Decaf with dinner.'],
    ],
  },
  r1b: {
    said:
      "Cathie is off to her sister's in Tucson next week. She left most of her chicken, said it was hard to chew. She'd like her dressing on the side.",
    heard: [
      ['know', 'Visiting her sister in Tucson next week.'],
      ['obs', 'Left most of her chicken; said it was hard to chew.'],
      ['pref', 'Dressing on the side.'],
    ],
  },
  r2: {
    said:
      "Eleanor's book club picked her suggestion for next month. She asked for extra lemon with her fish.",
    heard: [
      ['know', 'The book club picked her suggestion for next month.'],
      ['pref', 'Extra lemon with fish.'],
    ],
  },
  r3: {
    said:
      "Tom's model ship won a ribbon at the craft fair. He seemed tired today and barely touched his lunch. He did say the soup was too salty.",
    heard: [
      ['know', 'His model ship won a ribbon at the craft fair.'],
      ['obs', 'Seemed tired and barely touched his lunch.'],
      ['fb', 'Said the soup was too salty.'],
    ],
  },
  r4: {
    said:
      "Rose set the date for her granddaughter's wedding, it's in June. She wants her eggs over medium, not over easy.",
    heard: [
      ['know', "Granddaughter's wedding is set for June."],
      ['pref', 'Eggs over medium, not over easy.'],
    ],
  },
  r5: {
    said:
      "Walter was coughing a little with the soup. He'd like the window table whenever it's free.",
    heard: [
      ['obs', 'Coughed a little while eating soup.'],
      ['pref', 'Likes the window table when it is free.'],
    ],
  },
  r6: {
    said:
      'Joan sold her watercolor from the art show! She thought the flounder was a bit dry. No croutons on her salad from now on.',
    heard: [
      ['know', 'Sold her watercolor from the lobby art show.'],
      ['fb', 'Thought the flounder was a bit dry.'],
      ['pref', 'No croutons on salads.'],
    ],
  },
  r7: {
    said:
      "Frank's grandson scored the winning touchdown on Friday. He needed help cutting his chicken tonight.",
    heard: [
      ['know', 'Grandson scored the winning touchdown on Friday.'],
      ['obs', 'Needed help cutting his chicken.'],
    ],
  },
  r8: {
    said:
      "Mildred's great niece is visiting on Sunday. She had trouble reading the menu, so I read it to her. She likes her tea warm, not hot.",
    heard: [
      ['know', 'Her great niece is visiting on Sunday.'],
      ['obs', 'Had trouble reading the menu; the server read it to her.'],
      ['pref', 'Tea warm, not hot.'],
    ],
  },
  r9: {
    said:
      "Harold booked his Vancouver flight for the fourteenth. He asked if we could bring back the pot roast as a special. He'd like smaller portions at lunch.",
    heard: [
      ['know', 'Flies to Vancouver on the 14th.'],
      ['fb', 'Asked if we could bring back the pot roast as a special.'],
      ['pref', 'Smaller portions at lunch.'],
    ],
  },
  r10: {
    said:
      "Beatrice showed everyone photos of the baby, her name is Lily. She loved the pineapple trifle. She'd like her soup served in a mug.",
    heard: [
      ['know', 'Her great granddaughter is named Lily.'],
      ['fb', 'Loved the pineapple trifle.'],
      ['pref', 'Soup served in a mug.'],
    ],
  },
  r11: {
    said:
      "Keith said his pickleball team made the finals this weekend. He'd like his burger cooked medium well from now on.",
    heard: [
      ['know', 'His pickleball team made the finals this weekend.'],
      ['pref', 'Burger cooked medium well.'],
    ],
  },
};

/** Every written example (for tests of the sorter). */
export function writtenExamples(): Array<[string, VoiceSample]> {
  return Object.entries(SAMPLES);
}

const LIFE = [
  "{f}'s grandkids are visiting this weekend.",
  '{f} just got back from a cruise to Alaska.',
  '{f} is starting the Tuesday painting class.',
  '{f} has a birthday coming up on Saturday.',
];
const FOOD = ['{f} said the {d} was delicious.', '{f} thought the {d} was a little salty.', '{f} loved the {d} and asked to have it again.'];
const PREFS = ['{f} would like a to-go box brought out with dessert.', '{f} prefers iced tea with no ice.'];

/** The first dish (not a drink) a resident has on this check, entrées first. */
function dishOnCheck(residentId: string, o: Pick<Order, 'diners'>): string | undefined {
  const items = o.diners
    .filter((d) => d.kind === 'resident' && !d.isGuest && d.refId === residentId)
    .flatMap((d) => d.items)
    .filter((l) => !l.cancelled && !isDrink(l.itemId))
    .map((l) => getItem(l.itemId))
    .filter((it) => !!it);
  return (items.find((it) => it.entree) ?? items[0])?.name;
}

/** What a server might say about this resident at this table. */
export function exampleFor(r: Resident, o: Pick<Order, 'diners'>): string {
  const written = SAMPLES[r.id];
  if (written) return written.said;
  const first = r.name.split(' ')[0];
  const dish = dishOnCheck(r.id, o);
  const h = seedHash(r.id);
  const fill = (t: string) => t.replace('{f}', first).replace('{d}', (dish ?? '').toLowerCase());
  const parts = [fill(LIFE[h % LIFE.length])];
  if (dish) parts.push(fill(FOOD[(h >> 2) % FOOD.length]));
  if (h % 3 === 0) parts.push(fill(PREFS[(h >> 4) % PREFS.length]));
  return parts.join(' ');
}
