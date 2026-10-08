import { describe, expect, it } from 'vitest';
import { residents } from '../../../../data';
import { gameClues } from '../../../../store/residentStories';
import {
  BONUS_INTRO_MS,
  COUNTDOWN_MS,
  MAIN_MS,
  answerPoints,
  enoughForGame,
  gamePool,
  highScores,
  makeQuestions,
  playsLeft,
  timeBonus,
  type GamePlay,
} from '../residents/game/gameLogic';
import { gameReducer, initialGame, type GameState } from '../residents/game/gameMachine';

/** A repeatable random number generator for the tests. */
function rng(seed = 1) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return x / 2147483647;
  };
}

const play = (p: Partial<GamePlay>): GamePlay => ({ id: 'p', who: 'AA', name: 'Adriana', community: 'Home', at: 0, score: 0, right: 0, done: true, ...p });

describe('residents game rules', () => {
  it('scores right answers, faster scores more', () => {
    expect(answerPoints(false, 100, false).points).toBe(0);
    expect(answerPoints(true, 0, false)).toEqual({ points: 200, fast: true });
    expect(answerPoints(true, 4000, false).points).toBe(100);
    expect(answerPoints(true, 0, true).points).toBe(400);
    expect(timeBonus(10_400)).toBe(50);
  });

  it('allows five plays a day per associate', () => {
    const at = new Date(2026, 9, 7, 18).getTime();
    const plays = Array.from({ length: 4 }, (_, i) => play({ id: 'p' + i, at: at - i * 1000 }));
    expect(playsLeft(plays, 'AA', at)).toBe(1);
    expect(playsLeft(plays, 'RJ', at)).toBe(5);
    expect(playsLeft(plays, 'AA', at + 86_400_000)).toBe(5);
  });

  it('keeps each player best score, and my real games replace my seeded ones', () => {
    const at = Date.now();
    const list = highScores([play({ who: 'RJ', community: 'Home', score: 9999, at })], { me: 'RJ', home: 'Home', scope: 'home', period: '30', at });
    const rj = list.filter((x) => x.who === 'RJ');
    expect(rj).toHaveLength(1);
    expect(rj[0].score).toBe(9999);
    expect(list[0].who).toBe('RJ');
  });

  it('builds apartment questions with four different apartments', () => {
    const pool = gamePool(residents, ['IL', 'AL'], 'apartments', () => false);
    expect(enoughForGame(pool, 'apartments')).toBe(true);
    const q = makeQuestions(pool, 'apartments', gameClues, rng(7));
    expect(q.main.length).toBe(8);
    for (const x of q.main) {
      expect(x.options).toHaveLength(4);
      expect(new Set(x.options.map((r) => r.apt)).size).toBe(4);
      expect(x.options.some((r) => r.id === x.target.id)).toBe(true);
    }
    expect(q.bonus.every((b) => b.clue && gameClues(b.target.id).includes(b.clue))).toBe(true);
  });

  it('needs four residents with photos for the faces game', () => {
    expect(enoughForGame(gamePool(residents, ['IL', 'AL'], 'faces', () => false), 'faces')).toBe(false);
  });
});

describe('game clock', () => {
  const pool = gamePool(residents, ['IL', 'AL'], 'apartments', () => false);
  const q = makeQuestions(pool, 'apartments', gameClues, rng(3));
  const started = (): GameState => gameReducer(initialGame('setup', 0), { type: 'start', main: q.main, bonus: q.bonus, at: 0 });

  it('counts down, then runs round one', () => {
    let g = started();
    expect(g.phase).toBe('count');
    g = gameReducer(g, { type: 'tick', at: COUNTDOWN_MS });
    expect(g.phase).toBe('main');
    expect(g.endAt).toBe(COUNTDOWN_MS + MAIN_MS);
  });

  it('three misses ends the game', () => {
    let g = gameReducer(started(), { type: 'tick', at: COUNTDOWN_MS });
    let at = COUNTDOWN_MS;
    for (let i = 0; i < 3; i++) {
      const wrong = g.main[g.index].options.find((r) => r.id !== g.main[g.index].target.id)!;
      at += 500;
      g = gameReducer(g, { type: 'pick', residentId: wrong.id, at });
      at += 1300;
      g = gameReducer(g, { type: 'tick', at });
    }
    expect(g.phase).toBe('done');
    expect(g.why).toBe('out');
    expect(g.missed).toHaveLength(3);
    expect(g.timeBonus).toBe(0);
  });

  it('answering everything moves to the bonus, and finishing early earns a time bonus', () => {
    let g = gameReducer(started(), { type: 'tick', at: COUNTDOWN_MS });
    let at = COUNTDOWN_MS;
    while (g.phase === 'main') {
      at += 1000;
      g = gameReducer(g, { type: 'pick', residentId: g.main[g.index].target.id, at });
      at += 700;
      g = gameReducer(g, { type: 'tick', at });
    }
    expect(g.phase).toBe('bonusIntro');
    expect(g.right).toBe(8);
    at += BONUS_INTRO_MS;
    g = gameReducer(g, { type: 'tick', at });
    expect(g.phase).toBe('bonus');
    while (g.phase === 'bonus') {
      at += 1000;
      g = gameReducer(g, { type: 'pick', residentId: g.bonus[g.index].target.id, at });
      at += 700;
      g = gameReducer(g, { type: 'tick', at });
    }
    expect(g.phase).toBe('done');
    expect(g.why).toBe('done');
    expect(g.timeBonus).toBeGreaterThan(0);
  });

  it('runs out of time in the bonus round', () => {
    let g = gameReducer(started(), { type: 'tick', at: COUNTDOWN_MS });
    g = gameReducer(g, { type: 'tick', at: COUNTDOWN_MS + MAIN_MS });
    expect(g.phase).toBe('bonusIntro');
    g = gameReducer(g, { type: 'tick', at: COUNTDOWN_MS + MAIN_MS + BONUS_INTRO_MS });
    g = gameReducer(g, { type: 'tick', at: COUNTDOWN_MS + MAIN_MS + BONUS_INTRO_MS + 15_000 });
    expect(g.phase).toBe('done');
    expect(g.why).toBe('time');
  });
});
