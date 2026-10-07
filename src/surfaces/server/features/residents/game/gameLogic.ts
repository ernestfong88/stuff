/**
 * "Do you know the Residents?" A game of at most 60 seconds: 45 seconds
 * matching a name to one of four faces, then a 15 second bonus round
 * matching a detail from a resident's story. Faster answers score more,
 * three misses ends the game so tapping at random does not pay, and each
 * associate gets five games a day.
 *
 * The game needs faces. Until at least four residents have a photo on
 * file, round one asks for each resident's apartment instead, which is just
 * as useful to know on the floor.
 */
import { DAY, HOUR } from '../../../../../lib/clock';
import type { Resident } from '../../../../../domain/types';

export const MAX_PLAYS_PER_DAY = 5;
export const MAIN_MS = 45_000;
export const BONUS_MS = 15_000;
export const MAIN_QUESTIONS = 8;
export const BONUS_QUESTIONS = 3;
export const STRIKES_OUT = 3;
export const COUNTDOWN_MS = 2400;
export const BONUS_INTRO_MS = 2200;

export type GameMode = 'faces' | 'apartments';
export type CareType = 'IL' | 'AL' | 'MC';
export const CARE_TYPES: ReadonlyArray<[CareType, string]> = [
  ['IL', 'Independent Living'],
  ['AL', 'Assisted Living'],
  ['MC', 'Memory Care'],
];

export interface GamePlay {
  id: string;
  /** Staff initials. */
  who: string;
  name: string;
  community: string;
  at: number;
  score: number;
  right: number;
  done: boolean;
  why?: EndReason;
}

export type EndReason = 'done' | 'out' | 'time' | 'quit';

// ─── Plays and the high score board ──────────────────────────────────────

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function playsLeft(plays: GamePlay[], who: string, at: number): number {
  const today = dayKey(at);
  return Math.max(0, MAX_PLAYS_PER_DAY - plays.filter((p) => p.who === who && dayKey(p.at) === today).length);
}

/** Other associates here and at sister communities, so the board is not empty on day one. */
export function seededScores(home: string, at: number): GamePlay[] {
  const communities = [home, 'Crestavilla', 'Pacific Pointe', 'Sierra Ridge', 'Harbor Oaks'];
  const rows: Array<[string, string, number, Array<[number, number]>]> = [
    ['MT', 'Maria Torres', 0, [[2310, 3], [1980, 9], [2660, 41]]],
    ['RJ', 'Ricardo Juarez', 0, [[1745, 2], [2105, 16]]],
    ['DL', 'Darnell Lewis', 0, [[2440, 5], [2760, 77]]],
    ['SK', 'Sofia Kim', 0, [[1390, 1], [1880, 12]]],
    ['EN', 'Elena Navarro', 0, [[2015, 20], [1650, 50]]],
    ['JB', 'Jenna Brooks', 1, [[2530, 4], [2870, 95]]],
    ['TH', 'Tomas Herrera', 1, [[1960, 11]]],
    ['PW', 'Priya Walker', 1, [[2205, 7]]],
    ['CM', 'Carlos Mendez', 2, [[2745, 2]]],
    ['LG', 'Lauren Grant', 2, [[1820, 14], [2390, 120]]],
    ['OB', 'Omar Bashir', 3, [[2120, 6]]],
    ['KN', 'Kelly Nguyen', 3, [[2580, 19], [2810, 33]]],
    ['AR', 'Ana Ruiz', 4, [[1705, 8]]],
    ['BT', 'Ben Tran', 4, [[2360, 3]]],
  ];
  return rows.flatMap(([who, name, c, games]) =>
    games.map(([score, daysAgo], i) => ({
      id: `s${who}${i}`,
      who,
      name,
      community: communities[c],
      score,
      right: 0,
      at: at - daysAgo * DAY - (2 + i) * HOUR,
      done: true,
    })),
  );
}

export interface BoardOptions {
  me: string;
  home: string;
  scope: 'home' | 'all';
  period: '30' | 'all';
  at: number;
}

/** Each player's best finished game, best first. My own seeded rows give way to my real ones. */
export function highScores(plays: GamePlay[], o: BoardOptions): GamePlay[] {
  const cut = o.period === '30' ? o.at - 30 * DAY : 0;
  const best = new Map<string, GamePlay>();
  for (const p of [...seededScores(o.home, o.at).filter((x) => x.who !== o.me), ...plays.filter((x) => x.done)]) {
    if (p.at < cut || (o.scope === 'home' && p.community !== o.home)) continue;
    const k = p.who + '|' + p.community;
    const cur = best.get(k);
    if (!cur || p.score > cur.score) best.set(k, p);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.at - b.at);
}

export function myRank(plays: GamePlay[], o: BoardOptions): { rank: number; of: number; best: number; top: GamePlay | undefined } {
  const list = highScores(plays, o);
  const i = list.findIndex((x) => x.who === o.me && x.community === o.home);
  return { rank: i + 1, of: list.length, best: i < 0 ? 0 : list[i].score, top: list[0] };
}

// ─── Questions ───────────────────────────────────────────────────────────

export function shuffle<T>(list: T[], random: () => number = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Residents a game can ask about: with a photo (faces) or an apartment, of the chosen care types. */
export function gamePool(residents: Resident[], types: CareType[], mode: GameMode, hasPhoto: (id: string) => boolean): Resident[] {
  return residents.filter((r) => types.includes(r.level as CareType) && (mode === 'faces' ? hasPhoto(r.id) : !!r.apt));
}

export interface GameQuestion {
  target: Resident;
  options: Resident[];
  /** Bonus round: a line from their story. */
  clue?: string;
}

/**
 * Three wrong answers plus the right one. In apartment mode no two choices
 * share an apartment (couples live together), so every choice is distinct.
 */
function optionsFor(target: Resident, pool: Resident[], mode: GameMode, random: () => number): Resident[] {
  const picked: Resident[] = [];
  for (const r of shuffle(pool, random)) {
    if (picked.length === 3) break;
    if (r.id === target.id) continue;
    if (mode === 'apartments' && (r.apt === target.apt || picked.some((p) => p.apt === r.apt))) continue;
    picked.push(r);
  }
  return shuffle([target, ...picked], random);
}

export function makeQuestions(
  pool: Resident[],
  mode: GameMode,
  cluesOf: (id: string) => string[],
  random: () => number = Math.random,
): { main: GameQuestion[]; bonus: GameQuestion[] } {
  const main = shuffle(pool, random)
    .slice(0, MAIN_QUESTIONS)
    .map((target) => ({ target, options: optionsFor(target, pool, mode, random) }));
  const bonus = shuffle(
    pool.filter((r) => cluesOf(r.id).length),
    random,
  )
    .slice(0, BONUS_QUESTIONS)
    .map((target) => {
      const clues = cluesOf(target.id);
      return { target, options: optionsFor(target, pool, mode, random), clue: clues[Math.floor(random() * clues.length)] };
    });
  return { main, bonus };
}

/** Can a game be made from this pool at all? */
export function enoughForGame(pool: Resident[], mode: GameMode): boolean {
  return mode === 'faces' ? pool.length >= 4 : new Set(pool.map((r) => r.apt)).size >= 4;
}

/**
 * Points for one answer: 100 in round one, 200 in the bonus, plus up to the
 * same again for answering fast (gone after 4 seconds, 7 in the bonus).
 */
export function answerPoints(right: boolean, elapsedMs: number, bonus: boolean): { points: number; fast: boolean } {
  if (!right) return { points: 0, fast: false };
  const base = bonus ? 200 : 100;
  const speed = Math.max(0, Math.round(base * (1 - elapsedMs / (bonus ? 7000 : 4000))));
  return { points: base + speed, fast: speed >= base * 0.5 };
}

/** Finishing every question early: 5 points for each second left over. */
export function timeBonus(leftMs: number): number {
  return Math.round(Math.max(0, leftMs) / 1000) * 5;
}
