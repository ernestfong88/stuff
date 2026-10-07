import { useState } from 'react';
import { now } from '../../../../lib/clock';
import type { RecipeScore, Sentiment } from '../model/score';
import { cx } from '../../../../ui';
import { ScoreChip } from '../ui/recipeBits';
import s from './RecipeFeedback.module.css';

const SENT: Record<Sentiment, string> = { pos: 'Positive', neu: 'Neutral', neg: 'Negative' };

function when(at: number): string {
  const d = new Date(at);
  const base = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return d.getFullYear() !== new Date(now()).getFullYear() ? `${base} ${d.getFullYear()}` : base;
}

/** What residents said about a recipe, newest first, and how the score is built. */
export function RecipeFeedback({ score: sc }: { score: RecipeScore | null }) {
  const [all, setAll] = useState(false);
  const fb = sc?.feedback ?? [];
  const shown = all ? fb : fb.slice(0, 6);
  return (
    <section id="recipe-feedback" className={s.card}>
      <div className={s.head}>
        <h3 className={s.title}>Recipe score and resident feedback</h3>
        <ScoreChip sc={sc} big />
      </div>
      {sc && (
        <p className={s.summary}>
          Built from {sc.sales ? `${sc.sales.orders} ${sc.sales.src}` : 'no sales yet'}
          {sc.n
            ? ` and ${sc.n} resident ${sc.n === 1 ? 'comment' : 'comments'}: ${sc.pos} positive, ${sc.neu} neutral, ${sc.neg} negative.`
            : ', with no resident comments yet.'}
          {sc.trend === 'up'
            ? ' Comments in the last 3 weeks are warmer than before.'
            : sc.trend === 'down'
              ? ' Comments in the last 3 weeks are cooler than before.'
              : ''}
        </p>
      )}
      {!fb.length && <p className={s.muted}>No feedback linked to this recipe yet. Servers link it from a voice note or a check line.</p>}
      <ul className={s.list}>
        {shown.map((f) => (
          <li key={f.id} className={s.item}>
            <span className={cx(s.sent, s[f.sent])}>{SENT[f.sent]}</span>
            <div className={s.body}>
              <div className={s.quote}>“{f.text}”</div>
              <div className={s.meta}>{[f.who, when(f.at), [f.meal, f.venue].filter(Boolean).join(' · '), f.src].filter(Boolean).join(' · ')}</div>
            </div>
          </li>
        ))}
      </ul>
      {fb.length > 6 && (
        <button className={s.more} onClick={() => setAll((x) => !x)}>
          {all ? 'Show fewer' : `Show all ${fb.length}`}
        </button>
      )}
    </section>
  );
}
