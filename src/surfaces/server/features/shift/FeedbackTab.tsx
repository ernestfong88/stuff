import { useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { formatAgo } from '../../../../lib/format';
import { Chip, useNow } from '../../../../ui';
import { summarizeFeedback } from '../shared/feedback';
import { useTodaysFeedback } from './useTodaysFeedback';
import s from './FeedbackTab.module.css';

/** Dining feedback: everything residents said about the food today, summed up for everyone. */
export function FeedbackTab() {
  useNow(60_000);
  const [all, setAll] = useState(false);
  const items = useTodaysFeedback();
  const sum = summarizeFeedback(items);
  const line = (key: string, text: string, end?: string) => (
    <div key={key} className={s.line}>
      <span className={s.lineText}>{text}</span>
      {end && <span className={s.lineEnd}>{end}</span>}
    </div>
  );
  const section = (title: string, children: ReactNode[]) =>
    children.length > 0 && (
      <div className={s.section}>
        <h4 className={s.cap}>{title}</h4>
        {children}
      </div>
    );
  return (
    <div className={s.wrap}>
      <p className={s.intro}>
        Everything residents said about the food today, from every server's voice notes. The culinary team sees the same summary.
      </p>
      <section className={s.card}>
        <div className={s.kick}>
          <Sparkles size={14} aria-hidden /> Today's feedback · summary
        </div>
        {!items.length ? (
          <p className={s.empty}>No feedback collected yet today. Servers add it with the mic on a check.</p>
        ) : (
          <>
            <p className={s.head}>{sum.head}</p>
            {section(
              'By dish',
              sum.byDish.slice(0, 8).map((b) => (
                <div key={b.dish} className={s.dish}>
                  <span className={s.lineText}>
                    <b>{b.dish}</b>
                    {b.quote && <span className={s.quote}> · “{b.quote}”</span>}
                  </span>
                  <span className={b.neg > b.pos ? s.neg : b.pos ? s.pos : s.lineEnd}>
                    {[b.pos && `${b.pos} positive`, b.neg && `${b.neg} negative`, b.n - b.pos - b.neg > 0 && `${b.n - b.pos - b.neg} neutral`]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )),
            )}
            {section(
              'Going well',
              sum.liked.slice(0, 3).map(([d, n]) => line(d, d, `${n} positive`)),
            )}
            {section(
              'To look at',
              sum.issues.slice(0, 4).map((i) => line(i.key, i.label.charAt(0).toUpperCase() + i.label.slice(1) + (i.dishes.length ? ` · ${i.dishes.join(', ')}` : ''), String(i.n))),
            )}
            {section(
              'Residents asked for',
              sum.asks.slice(0, 3).map((r) => line(r.id, (r.who ? r.who.split(' ')[0] + ': ' : '') + r.text)),
            )}
            {section(
              'Suggested for the kitchen',
              sum.todo.map((t, i) => line('t' + i, '• ' + t)),
            )}
            <button type="button" className={s.toggle} onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? 'Hide the comments' : `Show all ${items.length} comments`}
            </button>
            {all && (
              <div className={s.comments}>
                {sum.rows.map((r) => (
                  <div key={r.id} className={s.comment}>
                    <div className={s.commentHead}>
                      <Chip size="xs" tone={r.neg ? 'danger' : r.pos ? 'success' : 'neutral'}>
                        {r.source}
                      </Chip>
                      <span className={s.commentWho}>{r.who}</span>
                      <span className={s.commentMeta}>{[r.by, r.where, formatAgo(r.at)].filter(Boolean).join(' · ')}</span>
                    </div>
                    <div className={s.commentText}>{r.text}</div>
                  </div>
                ))}
              </div>
            )}
            <p className={s.foot}>Summarized from servers' voice notes. It updates as feedback comes in.</p>
          </>
        )}
      </section>
    </div>
  );
}
