import { useEffect, useMemo, useState } from 'react';
import { Check, CircleHelp, X } from 'lucide-react';
import { tableName } from '../../../../domain/orders';
import type { Order } from '../../../../domain/types';
import { today } from '../../../../lib/clock';
import {
  ANSWER_LETTERS,
  dayScores,
  monthBoard,
  questionFor,
  resultLine,
  saveTriviaAnswers,
  todayIso,
  undoTriviaAnswers,
  useTrivia,
  type TriviaSave,
} from '../../../../store/trivia';
import { Avatar, Button, Modal, cx } from '../../../../ui';
import { tablePeople } from '../shared/tablePeople';
import { revealHeadline } from './triviaText';
import s from './TriviaDialog.module.css';

const UNDO_SECONDS = 10;
const NOT_PLAYING = -1;
const CONFETTI_COLORS = ['#E0A458', '#3F7D3F', '#145785', '#C8553D', '#7FB6DC', '#E8C46A'];

/** The table trivia question: read it out, tap each person's answer, reveal. */
export function TriviaDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const state = useTrivia();
  const iso = todayIso();
  const q = questionFor(iso);
  const people = useMemo(() => tablePeople(order), [order]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<TriviaSave | null>(null);
  const [undoLeft, setUndoLeft] = useState(0);
  // Who had already scored today when the question was opened (they play for fun).
  const [before] = useState(() => dayScores(state, iso));
  const revealed = saved != null;

  useEffect(() => {
    if (undoLeft <= 0) return;
    const t = setTimeout(() => setUndoLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [undoLeft]);

  const pick = (key: string, v: number) => {
    if (revealed) return;
    setAnswers((a) => {
      const next = { ...a };
      if (next[key] === v) delete next[key];
      else next[key] = v;
      return next;
    });
  };
  const clearOne = (key: string) =>
    setAnswers((a) => {
      const next = { ...a };
      delete next[key];
      return next;
    });

  const reveal = () => {
    const save = saveTriviaAnswers(
      order.id,
      people.map((p) => ({ residentId: p.residentId, choice: answers[p.key] })),
      q.answer,
    );
    setSaved(save);
    setUndoLeft(Object.keys(save.added).length ? UNDO_SECONDS : 0);
  };
  const undo = () => {
    if (saved && Object.keys(saved.added).length) undoTriviaAnswers(saved);
    setSaved(null);
    setUndoLeft(0);
  };

  const played = people.filter((p) => (answers[p.key] ?? NOT_PLAYING) >= 0);
  const right = played.filter((p) => answers[p.key] === q.answer);
  const leaders = monthBoard(state, today().getFullYear(), today().getMonth()).slice(0, 3);
  const savedCount = saved ? Object.keys(saved.added).length : 0;
  const lines =
    saved != null
      ? people
          .filter((p) => p.residentId && (answers[p.key] ?? NOT_PLAYING) >= 0)
          .map((p) => resultLine(state, p.first, p.residentId!, answers[p.key], q.answer, saved))
          .filter((l): l is string => !!l)
      : [];
  const answerText = `${ANSWER_LETTERS[q.answer]}, ${q.choices[q.answer]}`;

  return (
    <Modal open onClose={onClose} width={660} hideClose className={s.modal}>
      {revealed && right.length > 0 && (
        <div className={s.confetti} aria-hidden>
          {Array.from({ length: 26 }, (_, i) => (
            <span
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${(i % 9) * 0.07}s`,
                width: i % 3 ? 10 : 14,
                height: i % 3 ? 15 : 10,
              }}
            />
          ))}
        </div>
      )}
      <header className={s.head}>
        <span className={s.qIcon} aria-hidden>
          <CircleHelp size={20} />
        </span>
        <div className={s.titles}>
          <h2 className={s.title}>Trivia of the day</h2>
          <div className={s.sub}>
            {tableName(order)} · {today().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <span className={s.category}>{q.category}</span>
        <Button variant="secondary" iconOnly aria-label="Close" onClick={onClose} icon={<X size={18} />} />
      </header>

      <p className={s.question}>{q.question}</p>
      {!revealed && <p className={s.hint}>Read it aloud with the four choices, then tap each person's answer.</p>}

      {revealed && (
        <>
          <div className={s.choices}>
            {q.choices.map((t, i) => (
              <div key={i} className={cx(s.choice, i === q.answer ? s.choiceRight : s.choiceDim)}>
                <span className={s.letter}>{i === q.answer ? <Check size={16} strokeWidth={3} /> : ANSWER_LETTERS[i]}</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
          <div className={cx(s.result, right.length > 0 && s.resultWin)}>
            <div className={s.resultHead}>
              {revealHeadline(
                played.map((p) => p.first),
                right.map((p) => p.first),
                answerText,
              )}
            </div>
            <div className={s.fact}>{q.fact}</div>
          </div>
        </>
      )}

      <div className={s.people}>
        {!people.length && <p className={s.hint}>Add someone to this check to play.</p>}
        {people.map((p) => {
          const v = answers[p.key];
          const forFun = p.guest || (p.residentId != null && before[p.residentId] != null && saved == null);
          return (
            <div key={p.key} className={cx(s.person, revealed && s.personRevealed)}>
              <div className={s.personHead}>
                <Avatar person={p.resident ?? { name: p.name }} size={38} />
                <div className={s.personName}>
                  <div className={s.first}>{p.first}</div>
                  {forFun && <div className={s.forFun}>{p.guest ? 'Guest · plays for fun' : 'Already scored today · plays for fun'}</div>}
                </div>
                {revealed ? (
                  <span
                    className={cx(
                      s.verdict,
                      v === q.answer ? s.verdictRight : v != null && v >= 0 ? s.verdictWrong : undefined,
                    )}
                  >
                    {v === q.answer ? '✓ Right' : v != null && v >= 0 ? `Answered ${ANSWER_LETTERS[v]}` : v === NOT_PLAYING ? 'Not playing' : 'No answer'}
                  </span>
                ) : (
                  <div className={s.personActions}>
                    <button
                      type="button"
                      className={cx(s.notPlaying, v === NOT_PLAYING && s.notPlayingOn)}
                      aria-pressed={v === NOT_PLAYING}
                      onClick={() => pick(p.key, NOT_PLAYING)}
                    >
                      Not playing
                    </button>
                    <button type="button" className={s.clear} disabled={v == null} onClick={() => clearOne(p.key)} aria-label={`Clear ${p.first}'s answer`}>
                      Clear
                    </button>
                  </div>
                )}
              </div>
              {!revealed && (
                <div className={s.options} role="group" aria-label={`${p.first}'s answer`}>
                  {q.choices.map((t, i) => (
                    <button key={i} type="button" className={cx(s.option, v === i && s.optionOn)} aria-pressed={v === i} onClick={() => pick(p.key, i)}>
                      <span className={s.optionLetter}>{ANSWER_LETTERS[i]}</span>
                      <span>{t}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lines.length > 0 && (
        <div className={s.lines} role="status">
          {lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}

      <div className={s.footer}>
        {saved ? (
          <>
            {undoLeft > 0 ? (
              <Button variant="softDanger" size="xl" onClick={undo}>
                Undo <span className={s.undoSecs}>{undoLeft}s</span>
              </Button>
            ) : (
              <span className={s.savedNote}>
                {savedCount ? `Saved · ${saved.pts} ${saved.pts === 1 ? 'point' : 'points'} on the monthly board` : 'Nothing new to score today'}
              </span>
            )}
            <Button variant="dark" size="xl" className={undoLeft > 0 ? s.grow : undefined} onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button size="xl" disabled={!Object.keys(answers).length} onClick={() => setAnswers({})}>
              Clear all
            </Button>
            <Button variant="primary" size="xl" className={s.grow} onClick={reveal}>
              Reveal answer
            </Button>
          </>
        )}
      </div>

      {leaders.length > 0 && (
        <div className={s.leaders}>
          <span className={s.leadersTitle}>{today().toLocaleDateString('en-US', { month: 'long' })} leaders</span>
          {leaders.map((e) => {
            const parts = e.resident.name.split(' ');
            return (
              <span key={e.resident.id} className={s.leader}>
                <span className={cx(s.leaderRank, e.rank === 1 && s.gold)}>{e.rank}.</span>
                <Avatar person={e.resident} size={22} />
                {parts[0]} {(parts[parts.length - 1] ?? '').charAt(0)}.<span className={s.leaderPts}>{e.pts}</span>
              </span>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
