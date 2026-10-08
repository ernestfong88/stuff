/**
 * Trivia of the day.
 *
 * At the end of a meal the server reads one question with four choices to
 * the table and taps each person's answer. A right answer is one point,
 * once a day per resident; guests play for fun. Points add up to a monthly
 * scoreboard with prizes the community decides (Back Office, Trivia
 * Scoreboard). The questions rotate daily, so none repeats for about two
 * months.
 *
 * The demo has no history of its own, so earlier days this month and last
 * month are filled in from a steady, made-up rate per resident and per
 * server. Everything played on this device is saved on top of that.
 */
import { residents, staff } from '../data';
import type { Order, Resident } from '../domain/types';
import { today } from '../lib/clock';
import { createSharedStore, useShared } from '../lib/sharedStore';

export interface TriviaQuestion {
  category: string;
  question: string;
  choices: string[];
  /** Index of the right choice. */
  answer: number;
  /** A line to read out after the answer. */
  fact: string;
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    category: 'Music',
    question: 'Who was known as the King of Rock and Roll?',
    choices: ['Elvis Presley', 'Frank Sinatra', 'Bing Crosby', 'Buddy Holly'],
    answer: 0,
    fact: 'Elvis made his first record at Sun Studio in Memphis in 1954.',
  },
  {
    category: 'Movies',
    question: "In The Wizard of Oz, what color are Dorothy's slippers?",
    choices: ['Silver', 'Ruby red', 'Gold', 'Emerald green'],
    answer: 1,
    fact: 'In the original book the slippers were silver. The film made them red to show off Technicolor.',
  },
  {
    category: 'History',
    question: 'In what year did astronauts first walk on the moon?',
    choices: ['1965', '1969', '1972', '1959'],
    answer: 1,
    fact: 'Apollo 11 landed on July 20, 1969, and about 600 million people watched on TV.',
  },
  {
    category: 'Southern California',
    question: 'Which theme park opened in Anaheim in 1955?',
    choices: ["Knott's Berry Farm", 'Disneyland', 'SeaWorld', 'Universal Studios'],
    answer: 1,
    fact: 'Disneyland opened on July 17, 1955. Tickets were $1 for adults.',
  },
  {
    category: 'Food',
    question: 'What is the main ingredient in guacamole?',
    choices: ['Avocado', 'Cucumber', 'Green pepper', 'Peas'],
    answer: 0,
    fact: 'California grows most of the avocados in the United States, many of them in San Diego County.',
  },
  {
    category: 'Geography',
    question: 'What is the largest ocean on Earth?',
    choices: ['Atlantic', 'Indian', 'Pacific', 'Arctic'],
    answer: 2,
    fact: "The Pacific covers about a third of the Earth's surface.",
  },
  {
    category: 'Sports',
    question: 'How many players does a baseball team have on the field?',
    choices: ['7', '9', '11', '10'],
    answer: 1,
    fact: 'Nine players: a pitcher, a catcher, four infielders and three outfielders.',
  },
  {
    category: 'TV',
    question: "What was the name of Lucy's husband on I Love Lucy?",
    choices: ['Fred', 'Ricky', 'Desi', 'Ralph'],
    answer: 1,
    fact: 'Desi Arnaz played Ricky Ricardo, and he and Lucille Ball were married in real life.',
  },
  {
    category: 'General',
    question: 'Which planet is known as the Red Planet?',
    choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    answer: 1,
    fact: 'Mars looks red because of iron oxide, the same thing as rust, in its soil.',
  },
  {
    category: 'Music',
    question: "Which singer was nicknamed Ol' Blue Eyes?",
    choices: ['Dean Martin', 'Frank Sinatra', 'Perry Como', 'Tony Bennett'],
    answer: 1,
    fact: 'Sinatra recorded more than 1,000 songs over his career.',
  },
  {
    category: 'Movies',
    question: 'Which actor played Rhett Butler in Gone with the Wind?',
    choices: ['Clark Gable', 'Cary Grant', 'Gregory Peck', 'James Stewart'],
    answer: 0,
    fact: 'Gone with the Wind won eight competitive Academy Awards in 1940.',
  },
  {
    category: 'History',
    question: 'Which president was known as Ike?',
    choices: ['Dwight Eisenhower', 'Harry Truman', 'John F. Kennedy', 'Franklin Roosevelt'],
    answer: 0,
    fact: 'Eisenhower started the Interstate Highway System in 1956.',
  },
  {
    category: 'Southern California',
    question: 'The famous Hollywood sign originally spelled out which word?',
    choices: ['Hollywoodland', 'Hollywood Hills', 'Hollywood Studios', 'Hollygrove'],
    answer: 0,
    fact: 'It went up in 1923 to advertise a housing development. The "land" came down in 1949.',
  },
  {
    category: 'Food',
    question: 'Which fruit is dried to make a raisin?',
    choices: ['Plum', 'Grape', 'Cherry', 'Fig'],
    answer: 1,
    fact: "Most American raisins come from California's San Joaquin Valley.",
  },
  {
    category: 'Geography',
    question: 'What is the capital of Canada?',
    choices: ['Toronto', 'Ottawa', 'Montreal', 'Vancouver'],
    answer: 1,
    fact: 'Queen Victoria chose Ottawa as the capital in 1857.',
  },
  {
    category: 'Sports',
    question: 'Which baseball player was called the Sultan of Swat?',
    choices: ['Babe Ruth', 'Lou Gehrig', 'Ty Cobb', 'Joe DiMaggio'],
    answer: 0,
    fact: 'Babe Ruth hit 60 home runs in 1927, a record that stood for 34 years.',
  },
  {
    category: 'TV',
    question: 'Which show followed the Cartwright family on the Ponderosa ranch?',
    choices: ['Gunsmoke', 'Bonanza', 'The Rifleman', 'Rawhide'],
    answer: 1,
    fact: 'Bonanza ran for 14 seasons and was one of the first shows broadcast in color.',
  },
  {
    category: 'General',
    question: 'How many days are in a leap year?',
    choices: ['364', '365', '366', '367'],
    answer: 2,
    fact: 'The extra day, February 29, comes around every four years.',
  },
  {
    category: 'Music',
    question: 'Which band sang I Want to Hold Your Hand?',
    choices: ['The Rolling Stones', 'The Beach Boys', 'The Beatles', 'The Monkees'],
    answer: 2,
    fact: "It was the Beatles' first number one hit in America, in early 1964.",
  },
  {
    category: 'Movies',
    question: 'Who starred as Mary Poppins in 1964?',
    choices: ['Julie Andrews', 'Debbie Reynolds', 'Doris Day', 'Shirley Jones'],
    answer: 0,
    fact: 'Julie Andrews won the Academy Award for Best Actress for the role.',
  },
  {
    category: 'History',
    question: 'In which state did the Wright brothers make their first flight?',
    choices: ['North Carolina', 'Ohio', 'Virginia', 'Kansas'],
    answer: 0,
    fact: 'The first flight at Kitty Hawk in 1903 lasted just 12 seconds.',
  },
  {
    category: 'Southern California',
    question: 'The swallows famously return each spring to which mission?',
    choices: ['San Juan Capistrano', 'San Diego de Alcalá', 'Santa Barbara', 'San Gabriel'],
    answer: 0,
    fact: "Tradition says they arrive around March 19, St. Joseph's Day.",
  },
  {
    category: 'Food',
    question: "Which cookie is called Milk's Favorite Cookie?",
    choices: ['Chips Ahoy', 'Oreo', 'Nilla Wafer', 'Fig Newton'],
    answer: 1,
    fact: 'The Oreo was first sold in 1912 in New York City.',
  },
  {
    category: 'Geography',
    question: 'Mount Rushmore is in which state?',
    choices: ['South Dakota', 'Wyoming', 'Montana', 'North Dakota'],
    answer: 0,
    fact: "Each president's face on Mount Rushmore is about 60 feet tall.",
  },
  {
    category: 'Sports',
    question: 'How many holes are on a standard golf course?',
    choices: ['9', '12', '18', '21'],
    answer: 2,
    fact: 'The 18 hole round became the standard at St Andrews in Scotland in 1764.',
  },
  {
    category: 'TV',
    question: 'Which town did Sheriff Andy Taylor look after?',
    choices: ['Mayberry', 'Hooterville', 'Springfield', 'Pleasantville'],
    answer: 0,
    fact: 'The Andy Griffith Show was number one in the ratings in its final season.',
  },
  {
    category: 'General',
    question: 'How many legs does a spider have?',
    choices: ['Six', 'Eight', 'Ten', 'Twelve'],
    answer: 1,
    fact: 'Spiders are not insects. They are arachnids, which have eight legs.',
  },
  {
    category: 'Music',
    question: 'Who sang Respect in 1967?',
    choices: ['Diana Ross', 'Aretha Franklin', 'Patsy Cline', 'Dionne Warwick'],
    answer: 1,
    fact: 'Aretha Franklin was the first woman voted into the Rock and Roll Hall of Fame.',
  },
  {
    category: 'Movies',
    question: "In It's a Wonderful Life, what happens every time a bell rings?",
    choices: ['A baby is born', 'An angel gets his wings', 'It starts to snow', 'A wish comes true'],
    answer: 1,
    fact: "George Bailey's daughter Zuzu says the famous line at the end.",
  },
  {
    category: 'History',
    question: 'Which state joined the United States in 1959, a few months after Alaska?',
    choices: ['Hawaii', 'Arizona', 'New Mexico', 'Oklahoma'],
    answer: 0,
    fact: 'Hawaii became the 50th state on August 21, 1959.',
  },
  {
    category: 'Southern California',
    question: 'Which San Diego park is home to the famous zoo and many museums?',
    choices: ['Balboa Park', 'Griffith Park', 'Golden Gate Park', 'Mission Bay Park'],
    answer: 0,
    fact: "Balboa Park's buildings were built for the 1915 Panama-California Exposition.",
  },
  {
    category: 'Food',
    question: 'Which nut is used to make marzipan?',
    choices: ['Walnut', 'Almond', 'Pecan', 'Cashew'],
    answer: 1,
    fact: "California grows about 80 percent of the world's almonds.",
  },
  {
    category: 'Geography',
    question: 'Which country is shaped like a boot?',
    choices: ['Greece', 'Spain', 'Italy', 'Portugal'],
    answer: 2,
    fact: 'The island of Sicily sits just off the toe of the boot.',
  },
  {
    category: 'Sports',
    question: 'Which Dodgers pitcher threw a perfect game in 1965?',
    choices: ['Sandy Koufax', 'Don Drysdale', 'Orel Hershiser', 'Johnny Podres'],
    answer: 0,
    fact: 'Koufax struck out 14 batters in his perfect game against the Cubs.',
  },
  {
    category: 'TV',
    question: 'Who hosted The Tonight Show from 1962 to 1992?',
    choices: ['Jack Paar', 'Johnny Carson', 'Steve Allen', 'Ed Sullivan'],
    answer: 1,
    fact: 'Johnny Carson hosted about 4,500 episodes over 30 years.',
  },
  {
    category: 'General',
    question: 'What is the tallest animal in the world?',
    choices: ['Elephant', 'Giraffe', 'Moose', 'Camel'],
    answer: 1,
    fact: "A giraffe's legs alone can be taller than most people.",
  },
  {
    category: 'Music',
    question: 'Glenn Miller was famous for leading what kind of group?',
    choices: ['A big band', 'A barbershop quartet', 'A church choir', 'A folk trio'],
    answer: 0,
    fact: 'His recording of In the Mood topped the charts in 1940.',
  },
  {
    category: 'Movies',
    question: 'Which dancer partnered with Ginger Rogers in ten films?',
    choices: ['Gene Kelly', 'Fred Astaire', "Donald O'Connor", 'Ray Bolger'],
    answer: 1,
    fact: 'People joked that Ginger did everything Fred did, backwards and in high heels.',
  },
  {
    category: 'History',
    question: 'How many stars are on the United States flag?',
    choices: ['48', '50', '52', '46'],
    answer: 1,
    fact: 'The 50 star flag was first flown on July 4, 1960.',
  },
  {
    category: 'Southern California',
    question: 'What color is the California poppy?',
    choices: ['Red', 'Golden orange', 'Purple', 'White'],
    answer: 1,
    fact: "The golden poppy became California's state flower in 1903.",
  },
  {
    category: 'Food',
    question: 'Which city is famous for deep dish pizza?',
    choices: ['New York', 'Chicago', 'Boston', 'Detroit'],
    answer: 1,
    fact: 'Deep dish pizza was first served in Chicago in 1943.',
  },
  {
    category: 'Geography',
    question: 'How many Great Lakes are there?',
    choices: ['Three', 'Four', 'Five', 'Six'],
    answer: 2,
    fact: 'An easy way to remember them is HOMES: Huron, Ontario, Michigan, Erie and Superior.',
  },
  {
    category: 'Sports',
    question: 'Which boxer said he could float like a butterfly and sting like a bee?',
    choices: ['Joe Louis', 'Muhammad Ali', 'Rocky Marciano', 'Joe Frazier'],
    answer: 1,
    fact: 'Ali won the heavyweight title three times.',
  },
  {
    category: 'TV',
    question: 'Which loyal collie became a TV star in 1954?',
    choices: ['Lassie', 'Rin Tin Tin', 'Benji', 'Old Yeller'],
    answer: 0,
    fact: 'Every dog who played Lassie on TV was actually a male collie.',
  },
  {
    category: 'General',
    question: 'Which color do you get by mixing blue and yellow?',
    choices: ['Purple', 'Green', 'Orange', 'Brown'],
    answer: 1,
    fact: 'Blue, yellow and red are called the primary colors.',
  },
  {
    category: 'Music',
    question: 'Which instrument did Louis Armstrong famously play?',
    choices: ['Saxophone', 'Clarinet', 'Trumpet', 'Piano'],
    answer: 2,
    fact: 'His nickname Satchmo was short for satchel mouth.',
  },
  {
    category: 'Movies',
    question: 'Which actor went singing and dancing in the rain in 1952?',
    choices: ['Gene Kelly', 'Fred Astaire', 'Frank Sinatra', 'Danny Kaye'],
    answer: 0,
    fact: 'Gene Kelly filmed that famous scene with a fever.',
  },
  {
    category: 'History',
    question: 'The Golden Gate Bridge opened in which decade?',
    choices: ['The 1920s', 'The 1930s', 'The 1950s', 'The 1960s'],
    answer: 1,
    fact: 'It opened in 1937, and its color is called International Orange.',
  },
  {
    category: 'Southern California',
    question: 'Which famous highway runs along much of the California coast?',
    choices: ['Route 66', 'Pacific Coast Highway', 'Lincoln Highway', 'Interstate 10'],
    answer: 1,
    fact: 'Much of the coastal route is officially called State Route 1.',
  },
  {
    category: 'Food',
    question: 'A Waldorf salad has apples, celery and which nut?',
    choices: ['Walnuts', 'Peanuts', 'Pistachios', 'Macadamias'],
    answer: 0,
    fact: 'It was first made at the Waldorf Hotel in New York in 1893.',
  },
  {
    category: 'Geography',
    question: 'In which city is the Eiffel Tower?',
    choices: ['Rome', 'Paris', 'London', 'Vienna'],
    answer: 1,
    fact: "It was built for the 1889 World's Fair and was meant to be temporary.",
  },
  {
    category: 'Sports',
    question: 'From which city did the Dodgers move to Los Angeles in 1958?',
    choices: ['Brooklyn', 'Boston', 'St. Louis', 'Philadelphia'],
    answer: 0,
    fact: 'The Dodgers played at the Los Angeles Coliseum until Dodger Stadium opened in 1962.',
  },
  {
    category: 'TV',
    question: "What was the name of the Cleavers' younger son on Leave It to Beaver?",
    choices: ['Wally', 'Theodore', 'Eddie', 'Lumpy'],
    answer: 1,
    fact: 'Everyone called him the Beaver, but his real name was Theodore.',
  },
  {
    category: 'General',
    question: "What is the name of the great bell in London's clock tower?",
    choices: ['Big Ben', 'Great Tom', 'Liberty Bell', 'Old Bailey'],
    answer: 0,
    fact: 'Big Ben weighs more than 13 tons.',
  },
  {
    category: 'Music',
    question: 'Which singer made White Christmas famous?',
    choices: ['Bing Crosby', 'Nat King Cole', 'Gene Autry', 'Andy Williams'],
    answer: 0,
    fact: "Bing Crosby's White Christmas is one of the best-selling singles of all time.",
  },
  {
    category: 'Movies',
    question: 'Which film first featured the song Moon River?',
    choices: ["Breakfast at Tiffany's", 'Roman Holiday', 'The Apartment', 'West Side Story'],
    answer: 0,
    fact: 'Audrey Hepburn sang it herself, sitting on a fire escape with a guitar.',
  },
  {
    category: 'Southern California',
    question: 'Which Coronado hotel appears in the 1959 film Some Like It Hot?',
    choices: ['Hotel del Coronado', 'Beverly Hills Hotel', 'The Ambassador', 'The Biltmore'],
    answer: 0,
    fact: 'The Hotel del Coronado opened in 1888.',
  },
  {
    category: 'Food',
    question: 'Which spice gives pumpkin pie much of its warm flavor?',
    choices: ['Cinnamon', 'Paprika', 'Oregano', 'Cumin'],
    answer: 0,
    fact: 'Most pumpkin pie spice mixes combine cinnamon, ginger, nutmeg and cloves.',
  },
  {
    category: 'Music',
    question: 'Johnny Cash was known as the Man in what color?',
    choices: ['Black', 'White', 'Blue', 'Gray'],
    answer: 0,
    fact: 'He said he wore black for the poor and the forgotten.',
  },
  {
    category: 'Geography',
    question: 'What is the capital of Hawaii?',
    choices: ['Hilo', 'Honolulu', 'Kahului', 'Lahaina'],
    answer: 1,
    fact: 'Honolulu is on the island of Oahu, and its name means sheltered bay.',
  },
];

export const DEFAULT_TRIVIA_PRIZE =
  "First place picks a dessert for next month's menu. The top three are invited to a Chef's Table lunch.";

/** A resident's result on one day: 1 right, 0 answered but wrong. */
export type DayScores = Record<string, 0 | 1>;

export interface TriviaState {
  /** Answers saved on this device: day ("2026-10-07") → resident id → result. */
  days: Record<string, DayScores>;
  /** Check id → the day trivia was played at that table. */
  tables: Record<string, string>;
  /** Prize text set in Back Office; null keeps the default. */
  prize: string | null;
  /** Back Office switch: false hides trivia on the server tablets. Missing (older saves) means on. */
  enabled?: boolean;
}

export const triviaStore = createSharedStore<TriviaState>({ days: {}, tables: {}, prize: null }, {
  persistKey: 'kisco.trivia.v1',
  channel: 'kisco-trivia',
});

// ─── Days and questions ──────────────────────────────────────────────────

/** "2026-10-07" for a local date. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayIso(): string {
  return isoDay(today());
}

/** Small stable string hash (kept from the mockup so the seeded spread matches it). */
export function seedHash(s: string): number {
  let t = 0;
  for (const ch of s) t = (t * 31 + ch.charCodeAt(0)) % 9973;
  return t;
}

/** Which question a day gets: steps through the list 13 at a time from New Year 2026. */
export function questionIndex(iso: string, count = TRIVIA_QUESTIONS.length): number {
  const day = Math.round((Date.parse(iso + 'T12:00:00') - Date.parse('2026-01-01T12:00:00')) / 86_400_000);
  return (((day * 13) % count) + count) % count;
}

export function questionFor(iso: string): TriviaQuestion {
  return TRIVIA_QUESTIONS[questionIndex(iso)];
}

export const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

// ─── Seeded history ──────────────────────────────────────────────────────

let seedCache: { iso: string; days: Record<string, DayScores> } | null = null;

/**
 * Made-up results from the 1st of last month up to yesterday: about seven
 * in ten residents play, each at their own rate and skill.
 */
export function seededDays(todayIsoValue: string): Record<string, DayScores> {
  if (seedCache?.iso === todayIsoValue) return seedCache.days;
  const days: Record<string, DayScores> = {};
  const players = residents.filter((r) => seedHash('tv' + r.id) % 10 < 7).slice(0, 24);
  const noon = new Date(todayIsoValue + 'T12:00:00');
  for (let x = new Date(noon.getFullYear(), noon.getMonth() - 1, 1, 12); isoDay(x) < todayIsoValue; x.setDate(x.getDate() + 1)) {
    const iso = isoDay(x);
    for (const r of players) {
      const h = seedHash(r.id);
      const rate = 12 + (h % 50);
      const skill = 38 + ((h >> 4) % 42);
      if (seedHash(r.id + iso) % 100 < rate) (days[iso] ??= {})[r.id] = seedHash(iso + '|' + r.id) % 100 < skill ? 1 : 0;
    }
  }
  seedCache = { iso: todayIsoValue, days };
  return days;
}

/** Every result on a day: the seeded ones, then what was played here. */
export function dayScores(state: TriviaState, iso: string, nowIso: string = todayIso()): DayScores {
  return { ...seededDays(nowIso)[iso], ...state.days[iso] };
}

// ─── Monthly board ───────────────────────────────────────────────────────

export interface BoardEntry {
  resident: Resident;
  pts: number;
  /** Days they played. */
  days: number;
  /** 1-based; residents with the same points share a rank. */
  rank: number;
}

/** Standings for a month (month is 0-based), best first. */
export function monthBoard(state: TriviaState, year: number, month: number, nowIso: string = todayIso()): BoardEntry[] {
  const totals = new Map<string, { pts: number; days: number }>();
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const scores = dayScores(state, isoDay(new Date(year, month, day, 12)), nowIso);
    for (const [rid, v] of Object.entries(scores)) {
      const t = totals.get(rid) ?? { pts: 0, days: 0 };
      t.pts += v;
      t.days += 1;
      totals.set(rid, t);
    }
  }
  const list = [...totals.entries()]
    .map(([rid, t]) => ({ resident: residents.find((r) => r.id === rid), ...t }))
    .filter((e): e is Omit<BoardEntry, 'rank'> => !!e.resident)
    .sort((a, b) => b.pts - a.pts || a.days - b.days || a.resident.name.localeCompare(b.resident.name));
  return list.map((e) => ({ ...e, rank: 1 + list.filter((x) => x.pts > e.pts).length }));
}

export interface Standing {
  /** "in 3rd place" or "tied for 3rd place" */
  place: string;
  of: number;
  pts: number;
  days: number;
}

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th';
  return n + s;
};

/** Where a resident stands this month. */
export function standingOf(state: TriviaState, residentId: string, at: Date = today()): Standing | null {
  const board = monthBoard(state, at.getFullYear(), at.getMonth(), isoDay(at));
  const e = board.find((x) => x.resident.id === residentId);
  if (!e) return null;
  const tied = board.filter((x) => x.pts === e.pts).length > 1;
  return { place: `${tied ? 'tied for' : 'in'} ${ordinal(e.rank)} place`, of: board.length, pts: e.pts, days: e.days };
}

// ─── Playing at a table ──────────────────────────────────────────────────

export interface TriviaAnswer {
  /** Resident id; guests have none and play for fun. */
  residentId?: string;
  /** Choice index, or -1 for "Not playing", or undefined for no answer. */
  choice?: number;
}

/** What one reveal saved, so it can be undone exactly. */
export interface TriviaSave {
  iso: string;
  orderId: string;
  /** Resident id → the result saved for them now. */
  added: DayScores;
  /** Points earned. */
  pts: number;
  /** The table's earlier "played" day, restored on undo. */
  previousTable?: string;
}

/**
 * Save a table's answers. A resident who already scored today plays for
 * fun, and so does anyone without a resident record.
 */
export function withAnswers(
  state: TriviaState,
  orderId: string,
  answers: TriviaAnswer[],
  correct: number,
  iso: string = todayIso(),
): { state: TriviaState; save: TriviaSave } {
  const already = dayScores(state, iso, iso);
  const added: DayScores = {};
  let pts = 0;
  for (const a of answers) {
    if (!a.residentId || a.choice == null || a.choice < 0) continue;
    if (already[a.residentId] != null || added[a.residentId] != null) continue;
    added[a.residentId] = a.choice === correct ? 1 : 0;
    pts += added[a.residentId];
  }
  const next: TriviaState = {
    ...state,
    days: { ...state.days, [iso]: { ...state.days[iso], ...added } },
    tables: { ...state.tables, [orderId]: iso },
  };
  return { state: next, save: { iso, orderId, added, pts, previousTable: state.tables[orderId] } };
}

/** Take back exactly what one reveal saved, so the table can be played again. */
export function withoutSave(state: TriviaState, save: TriviaSave): TriviaState {
  const day = { ...state.days[save.iso] };
  for (const rid of Object.keys(save.added)) delete day[rid];
  const days = { ...state.days };
  if (Object.keys(day).length) days[save.iso] = day;
  else delete days[save.iso];
  const tables = { ...state.tables };
  if (save.previousTable) tables[save.orderId] = save.previousTable;
  else delete tables[save.orderId];
  return { ...state, days, tables };
}

export function saveTriviaAnswers(orderId: string, answers: TriviaAnswer[], correct: number): TriviaSave {
  let result: TriviaSave | null = null;
  triviaStore.set((s) => {
    const r = withAnswers(s, orderId, answers, correct);
    result = r.save;
    return r.state;
  });
  return result!;
}

export function undoTriviaAnswers(save: TriviaSave): void {
  triviaStore.set((s) => withoutSave(s, save));
}

export function setTriviaPrize(text: string): void {
  triviaStore.set((s) => ({ ...s, prize: text }));
}

/** Trivia of the day is on unless Back Office has turned it off. */
export function triviaOn(state: TriviaState): boolean {
  return state.enabled !== false;
}

export function setTriviaOn(on: boolean): void {
  triviaStore.set((s) => ({ ...s, enabled: on }));
}

export function useTriviaOn(): boolean {
  return triviaOn(useShared(triviaStore));
}

export function triviaPrize(state: TriviaState): string {
  return state.prize ?? DEFAULT_TRIVIA_PRIZE;
}

/** What to tell the table about one resident after the reveal. */
export function resultLine(
  state: TriviaState,
  firstName: string,
  residentId: string,
  choice: number,
  correct: number,
  save: TriviaSave,
): string | null {
  const st = standingOf(state, residentId);
  if (!st) return null;
  const where = `${firstName} is ${st.place} out of ${st.of} residents playing this month, with ${st.pts} ${st.pts === 1 ? 'point.' : 'points.'}`;
  if (save.added[residentId] == null) return `${firstName} already scored today, so this one was for fun. ${where}`;
  const first = st.days === 1 ? `It's ${firstName}'s first game this month. ` : '';
  return choice === correct
    ? `Got it! ${first}${where}`
    : `Got it. ${first}Not this time, so no point today (each right answer is worth 1 point). ${where}`;
}

// ─── Trivia at each server's tables ──────────────────────────────────────

/** How often a server plays trivia at a table, for the made-up earlier days. */
const serverRate = (server: string) => 45 + (seedHash('tvs' + server) % 45);

/** Was trivia played at this check today? */
export function playedAt(state: TriviaState, orderId: string, iso: string = todayIso()): boolean {
  return state.tables[orderId] === iso;
}

export interface ServerTriviaRow {
  server: string;
  tables: number;
  played: number;
  /** Percent of tables, or null with no tables. */
  pct: number | null;
}

/**
 * How often each server played the question with a table in a month. A
 * table counts once the answer is revealed there. Earlier days come from a
 * steady rate per server; today counts the real checks.
 */
export function serverTrivia(state: TriviaState, year: number, month: number, live: Order[], at: Date = today()): ServerTriviaRow[] {
  const current = year === at.getFullYear() && month === at.getMonth();
  const lastDay = current ? at.getDate() - 1 : new Date(year, month + 1, 0).getDate();
  const dineIn = live.filter((o) => !o.queueType && o.server);
  const servers = [
    ...new Set([...staff.filter((s) => /server/i.test(s.role)).map((s) => s.initials), ...dineIn.map((o) => o.server)]),
  ];
  const nowIso = isoDay(at);
  return servers
    .map((server) => {
      const rate = serverRate(server);
      let tables = 0;
      let played = 0;
      for (let day = 1; day <= lastDay; day++) {
        const iso = isoDay(new Date(year, month, day, 12));
        if (seedHash(server + '|' + iso) % 7 < 2) continue;
        const k = 3 + (seedHash(iso + '|' + server) % 4);
        tables += k;
        for (let i = 0; i < k; i++) if (seedHash(server + iso + i) % 100 < rate) played++;
      }
      if (current) {
        const todays = dineIn.filter((o) => o.server === server && (o.closedAt || playedAt(state, o.id, nowIso)));
        tables += todays.length;
        played += todays.filter((o) => playedAt(state, o.id, nowIso)).length;
      }
      return { server, tables, played, pct: tables ? Math.round((played / tables) * 100) : null };
    })
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.server.localeCompare(b.server));
}

export function useTrivia(): TriviaState {
  return useShared(triviaStore);
}
