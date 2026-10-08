/**
 * The game as a pure state machine, driven by a clock tick and taps, so
 * the timing rules can be tested without a browser.
 */
import type { Resident } from '../../../../../domain/types';
import {
  BONUS_INTRO_MS,
  BONUS_MS,
  COUNTDOWN_MS,
  MAIN_MS,
  STRIKES_OUT,
  answerPoints,
  timeBonus,
  type EndReason,
  type GameQuestion,
} from './gameLogic';

export type GamePhase = 'board' | 'setup' | 'count' | 'main' | 'bonusIntro' | 'bonus' | 'done';

export interface Feedback {
  /** The face (resident) that was tapped. */
  pickedId: string;
  right: boolean;
  points: number;
  fast: boolean;
}

export interface GameState {
  phase: GamePhase;
  /** When the current phase started. */
  phaseAt: number;
  main: GameQuestion[];
  bonus: GameQuestion[];
  /** Index of the current question in the current round. */
  index: number;
  /** When the current question was shown (for the speed bonus). */
  shownAt: number;
  /** When the current round's clock runs out. */
  endAt: number;
  strikes: number;
  missed: Resident[];
  score: number;
  right: number;
  feedback: Feedback | null;
  /** While feedback shows, the clock is paused until this time. */
  holdUntil: number;
  /** Time left on round one when it ended early. */
  mainLeft: number;
  timeBonus: number;
  why: EndReason | null;
}

export type GameAction =
  | { type: 'setup' }
  | { type: 'board' }
  | { type: 'start'; main: GameQuestion[]; bonus: GameQuestion[]; at: number }
  | { type: 'tick'; at: number }
  | { type: 'pick'; residentId: string; at: number };

/** How long the right (or wrong) answer stays on screen before the next question. */
const HOLD_RIGHT = 650;
const HOLD_WRONG = 1200;

export function initialGame(phase: 'board' | 'setup', at: number): GameState {
  return {
    phase,
    phaseAt: at,
    main: [],
    bonus: [],
    index: 0,
    shownAt: at,
    endAt: at,
    strikes: 0,
    missed: [],
    score: 0,
    right: 0,
    feedback: null,
    holdUntil: 0,
    mainLeft: 0,
    timeBonus: 0,
    why: null,
  };
}

function finish(s: GameState, why: EndReason, at: number, bonusLeft: number): GameState {
  const tb = why === 'done' ? timeBonus(s.mainLeft + bonusLeft) : 0;
  return { ...s, phase: 'done', phaseAt: at, why, feedback: null, timeBonus: tb, score: s.score + tb };
}

function toBonus(s: GameState, at: number, mainLeft: number): GameState {
  const next = { ...s, mainLeft, feedback: null };
  if (!s.bonus.length) return finish(next, 'done', at, 0);
  return { ...next, phase: 'bonusIntro', phaseAt: at };
}

export function currentQuestion(s: GameState): GameQuestion | undefined {
  return (s.phase === 'bonus' ? s.bonus : s.main)[s.index];
}

export function gameReducer(s: GameState, a: GameAction): GameState {
  switch (a.type) {
    case 'setup':
      return { ...initialGame('setup', s.phaseAt) };
    case 'board':
      return { ...s, phase: 'board' };
    case 'start':
      return { ...initialGame('setup', a.at), phase: 'count', phaseAt: a.at, main: a.main, bonus: a.bonus };
    case 'pick': {
      if ((s.phase !== 'main' && s.phase !== 'bonus') || s.feedback) return s;
      const q = currentQuestion(s);
      if (!q) return s;
      const right = q.target.id === a.residentId;
      const { points, fast } = answerPoints(right, a.at - s.shownAt, s.phase === 'bonus');
      const hold = right ? HOLD_RIGHT : HOLD_WRONG;
      return {
        ...s,
        feedback: { pickedId: a.residentId, right, points, fast },
        score: s.score + points,
        right: s.right + (right ? 1 : 0),
        strikes: s.strikes + (right ? 0 : 1),
        missed: right ? s.missed : [...s.missed, q.target],
        // The clock stops while the answer shows.
        endAt: s.endAt + hold,
        holdUntil: a.at + hold,
      };
    }
    case 'tick': {
      const at = a.at;
      if (s.phase === 'count' && at - s.phaseAt >= COUNTDOWN_MS)
        return { ...s, phase: 'main', phaseAt: at, endAt: at + MAIN_MS, index: 0, shownAt: at };
      if (s.phase === 'bonusIntro' && at - s.phaseAt >= BONUS_INTRO_MS)
        return { ...s, phase: 'bonus', phaseAt: at, endAt: at + BONUS_MS, index: 0, shownAt: at };
      if (s.phase !== 'main' && s.phase !== 'bonus') return s;
      const bonus = s.phase === 'bonus';
      if (s.feedback) {
        if (at < s.holdUntil) return s;
        const cleared = { ...s, feedback: null };
        if (s.strikes >= STRIKES_OUT) return finish(cleared, 'out', at, 0);
        const round = bonus ? s.bonus : s.main;
        if (s.index + 1 >= round.length) {
          const left = Math.max(0, s.endAt - at);
          return bonus ? finish(cleared, 'done', at, left) : toBonus(cleared, at, left);
        }
        return { ...cleared, index: s.index + 1, shownAt: at };
      }
      if (at >= s.endAt) return bonus ? finish(s, 'time', at, 0) : toBonus(s, at, 0);
      return s;
    }
  }
}
