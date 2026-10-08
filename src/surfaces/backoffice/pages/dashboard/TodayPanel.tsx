import { useState } from 'react';
import { Check, Sparkles, TriangleAlert } from 'lucide-react';
import { Tabs, cx } from '../../../../ui';
import { BoCaption } from '../../kit';
import { readComment, tallyDishes, themeOf } from './model/feedback';
import type { DashboardData } from './model/useDashboardData';
import { DetailsToggle, useRemembered } from './parts';
import { PmixTodayCard } from './PmixTodayCard';
import s from './dashboard.module.css';

const dayTab = (a: number, today: boolean, i: number) =>
  today ? 'Today' : i === 1 ? 'Yesterday' : new Date(a).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

/** What residents said, day by day: what did well, what did poorly and what to do. */
function FeedbackByDay({ data }: { data: DashboardData }) {
  const days = data.recentFeedback.map((d, i) => ({ ...d, label: dayTab(d.a, d.today, i) })).filter((d) => d.count.n > 0);
  const [sel, setSel] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useRemembered('feedback', false);
  const cur = days.find((d) => String(d.a) === sel) ?? days[0];
  if (!cur)
    return (
      <section className={s.card} aria-label="Resident feedback">
        <h2 className={s.cardCap}>Resident feedback</h2>
        <p className={s.muted}>No feedback in the last 7 days. Servers add it with the mic on a check.</p>
      </section>
    );
  const dishes = [...tallyDishes([{ a: cur.a, items: cur.items }]).values()];
  const good = dishes.filter((b) => b.pos > b.neg).sort((a, b) => b.pos - a.pos);
  const bad = dishes.filter((b) => b.neg > 0 && b.neg >= b.pos).sort((a, b) => b.neg - a.neg);
  const mid = dishes.filter((b) => !b.pos && !b.neg);
  const people = new Set(cur.items.map((x) => x.who).filter(Boolean)).size;
  const why = (b: (typeof dishes)[number]) =>
    [...b.themes.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([k]) => themeOf(k)?.label)
      .filter(Boolean)
      .join(', ');
  const tip = (b: (typeof dishes)[number]) => {
    const top = [...b.themes.entries()].sort((x, y) => y[1] - x[1])[0];
    return top ? themeOf(top[0])?.tip(b.dish) : undefined;
  };
  const praise = (dish: string) => cur.items.map(readComment).find((c) => c.dish === dish && c.pos && c.src !== 'Rating')?.text;
  const highlight = `${cur.count.n} ${cur.count.n === 1 ? 'comment' : 'comments'} from ${people} ${people === 1 ? 'resident' : 'residents'}.${good[0] ? ` Best received: ${good[0].dish}.` : ''}${bad[0] ? ` Needs attention: ${bad[0].dish}${why(bad[0]) ? ` (${why(bad[0]).split(', ')[0]})` : ''}.` : ' No complaints.'}`;

  return (
    <section className={s.card} aria-label="Resident feedback">
      <h2 className={s.cardCap}>Resident feedback</h2>
      <div className={s.highlight}>
        <Sparkles size={16} aria-hidden />
        <div>
          <div className={s.highlightCap}>Highlight · {cur.label}</div>
          <div>{highlight}</div>
        </div>
      </div>
      <DetailsToggle open={open} onToggle={() => setOpen(!open)} controls="dash-feedback-detail" />
      {open && (
        <div id="dash-feedback-detail" className={s.details}>
          <Tabs
            size="sm"
            aria-label="Day"
            value={String(cur.a)}
            onChange={(v) => {
              setSel(v);
              setAll(false);
            }}
            options={days.map((d) => ({ id: String(d.a), label: d.label, count: d.count.n }))}
          />
          <div className={s.fbCols}>
            {[
              { ok: true, title: 'Did well', list: good, empty: 'No dish got clear praise yet.' },
              { ok: false, title: 'Did poorly', list: bad, empty: 'Nothing did poorly. No complaints.' },
            ].map((col) => (
              <div key={col.title} className={s.fbCol}>
                <div className={s.fbColHead}>
                  <span>{col.title}</span>
                  <span className={s.muted}>
                    {col.list.length} {col.list.length === 1 ? 'dish' : 'dishes'}
                  </span>
                </div>
                {col.list.length === 0 && <p className={s.muted}>{col.empty}</p>}
                {col.list.map((b) => {
                  const quote = col.ok ? praise(b.dish) : b.quote;
                  const next = col.ok ? undefined : tip(b);
                  return (
                    <div key={b.dish} className={cx(s.fbItem, col.ok ? s.fbGood : s.fbBad)}>
                      <span className={s.fbMark} aria-hidden>
                        {col.ok ? <Check size={13} /> : <TriangleAlert size={13} />}
                      </span>
                      <div className={s.fbText}>
                        <div className={s.fbDish}>{b.dish}</div>
                        {!col.ok && why(b) && <div className={s.fbWhy}>{why(b).charAt(0).toUpperCase() + why(b).slice(1)}</div>}
                        {quote && <div className={s.fbQuote}>“{quote}”</div>}
                        {next && (
                          <div className={s.fbNext}>
                            <b>Next step:</b> {next}
                          </div>
                        )}
                      </div>
                      <span className={s.fbN}>{col.ok ? `${b.pos} liked` : `${b.neg} disliked`}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className={s.fbFoot}>
            {mid.length > 0 && <span className={s.muted}>Also mentioned, no clear verdict: {mid.map((b) => b.dish).join(', ')}</span>}
            <button className={s.textLink} aria-expanded={all} onClick={() => setAll(!all)}>
              {all ? 'Hide the comments' : `Read all ${cur.count.n} comments`}
            </button>
          </div>
          {all && (
            <ul className={s.comments}>
              {cur.items.map((f) => (
                <li key={f.id} className={s.comment}>
                  <span
                    className={cx(s.sentDot, s[`sent_${f.sent}`])}
                    aria-label={f.sent === 'pos' ? 'Positive' : f.sent === 'neg' ? 'Negative' : 'Neutral'}
                  />
                  <div>
                    <span className={s.commentWho}>{f.who || 'Resident'}</span>
                    <span className={s.commentMeta}>
                      {' '}
                      ·{' '}
                      {[f.by, f.where, new Date(f.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <div className={s.commentText}>{f.text}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** Below the trend cards: what was served today and today's feedback. */
export function TodayPanel({ data, goto }: { data: DashboardData; goto: (pageId: string) => void }) {
  return (
    <div className={s.today}>
      <BoCaption>Today</BoCaption>
      <div className={s.todayGrid}>
        <PmixTodayCard goto={goto} />
        <FeedbackByDay data={data} />
      </div>
    </div>
  );
}
