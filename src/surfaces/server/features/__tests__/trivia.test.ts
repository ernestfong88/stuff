import { describe, expect, it } from 'vitest';
import {
  TRIVIA_QUESTIONS,
  dayScores,
  isoDay,
  monthBoard,
  questionIndex,
  seededDays,
  serverTrivia,
  withAnswers,
  withoutSave,
  type TriviaState,
} from '../../../../store/trivia';
import type { Order } from '../../../../domain/types';
import { joinNames, revealHeadline } from '../trivia/triviaText';

const empty: TriviaState = { days: {}, tables: {}, prize: null };
const ISO = '2026-10-07';

describe('trivia questions', () => {
  it('rotates through every question before repeating', () => {
    const n = TRIVIA_QUESTIONS.length;
    const seen = new Set<number>();
    const start = new Date(2026, 0, 1, 12);
    for (let i = 0; i < n; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      seen.add(questionIndex(isoDay(d)));
    }
    expect(seen.size).toBe(n);
  });

  it('every question has four choices and a valid answer', () => {
    for (const q of TRIVIA_QUESTIONS) {
      expect(q.choices).toHaveLength(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
    }
  });
});

describe('scoring a table', () => {
  it('gives one point per right answer, once a day, and nothing to guests', () => {
    const { state, save } = withAnswers(
      empty,
      'o1',
      [
        { residentId: 'r100', choice: 1 },
        { residentId: 'r101', choice: 2 },
        { choice: 1 },
        { residentId: 'r102', choice: -1 },
      ],
      1,
      ISO,
    );
    expect(save.added).toEqual({ r100: 1, r101: 0 });
    expect(save.pts).toBe(1);
    expect(state.tables.o1).toBe(ISO);
    const again = withAnswers(state, 'o2', [{ residentId: 'r100', choice: 1 }], 1, ISO);
    expect(again.save.added).toEqual({});
  });

  it('undo takes back exactly what one reveal saved', () => {
    const first = withAnswers(empty, 'o1', [{ residentId: 'r100', choice: 1 }], 1, ISO);
    const second = withAnswers(first.state, 'o2', [{ residentId: 'r101', choice: 1 }], 1, ISO);
    const undone = withoutSave(second.state, second.save);
    expect(undone.days[ISO]).toEqual({ r100: 1 });
    expect(undone.tables.o2).toBeUndefined();
    expect(undone.tables.o1).toBe(ISO);
  });
});

describe('monthly board', () => {
  it('ranks by points with ties sharing a place', () => {
    // A month after "today", so no seeded days mix in.
    const state: TriviaState = { ...empty, days: { '2031-01-05': { r1: 1, r2: 1, r3: 0 } } };
    const board = monthBoard(state, 2031, 0, '2030-06-15');
    const rank = Object.fromEntries(board.map((e) => [e.resident.id, e.rank]));
    expect(rank.r1).toBe(1);
    expect(rank.r2).toBe(1);
    expect(rank.r3).toBe(3);
  });

  it('seeds last month and this month up to yesterday, never today', () => {
    const days = seededDays(ISO);
    expect(Object.keys(days).some((d) => d >= ISO)).toBe(false);
    expect(Object.keys(days).some((d) => d.startsWith('2026-09'))).toBe(true);
    expect(dayScores(empty, ISO, ISO)).toEqual({});
  });
});

describe('server trivia rates', () => {
  it("counts today's checks where trivia was played", () => {
    const at = new Date(2026, 9, 7, 18);
    const o = { id: 'x1', server: 'AA', diners: [], closedAt: at.getTime() } as unknown as Order;
    const before = serverTrivia(empty, 2026, 9, [o], at).find((r) => r.server === 'AA')!;
    const played = serverTrivia({ ...empty, tables: { x1: ISO } }, 2026, 9, [o], at).find((r) => r.server === 'AA')!;
    expect(played.played).toBe(before.played + 1);
    expect(played.tables).toBe(before.tables);
  });
});

describe('reveal text', () => {
  it('reads naturally', () => {
    expect(joinNames(['Ann', 'Bob', 'Cy'])).toBe('Ann, Bob and Cy');
    expect(revealHeadline([], [], 'B, Mars')).toBe('The answer is B, Mars.');
    expect(revealHeadline(['Ann'], ['Ann'], 'B')).toBe('Ann is right!');
    expect(revealHeadline(['Ann', 'Bob'], ['Ann', 'Bob'], 'B')).toBe('Everyone is right!');
    expect(revealHeadline(['Ann', 'Bob'], ['Bob'], 'B')).toBe('Bob got it right!');
    expect(revealHeadline(['Ann'], [], 'B')).toBe('A tricky one. Nobody got it right today.');
  });
});
