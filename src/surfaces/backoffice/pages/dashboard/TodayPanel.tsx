import { useState } from 'react';
import { Check, Sparkles, TriangleAlert } from 'lucide-react';
import { catalog } from '../../../../data';
import { startOfToday } from '../../../../lib/clock';
import { useDining } from '../../../../store/dining';
import { Chip, Tabs, cx } from '../../../../ui';
import { BoCaption, CHART, MeterBar } from '../../kit';
import { SPECIALS_MADE, SPECIALS_SOLD_EARLIER } from '../../seed/dashboard';
import { isoDate } from '../../../../domain/pickup';
import { readComment, tallyDishes, themeOf } from './model/feedback';
import { countSpecial, specialsToday } from './model/specials';
import type { DashboardData } from './model/useDashboardData';
import s from './dashboard.module.css';

const SPECIALS = specialsToday(catalog);

/** Today's specials: made against ordered so far. */
function SpecialsMadeOrdered() {
  const { orders, history, assocOrders } = useDining();
  const checks = [...orders, ...history];
  const opts = { todayStart: startOfToday(), todayIso: isoDate(0) };
  return (
    <section className={s.card} aria-label="Today's specials, made and ordered">
      <h2 className={s.cardCap}>Today's specials · made and ordered so far</h2>
      {SPECIALS.length === 0 && <p className={s.muted}>No specials on today's menu.</p>}
      <ul className={s.specials}>
        {SPECIALS.map((sp) => {
          const c = countSpecial(sp, checks, assocOrders, { ...opts, made: SPECIALS_MADE[sp.id] ?? 30, earlier: SPECIALS_SOLD_EARLIER[sp.id] ?? 0 });
          const tone = c.left < 0 ? 'danger' : c.left <= 5 ? 'warning' : 'success';
          return (
            <li key={sp.id} className={s.special}>
              <div className={s.specialHead}>
                <span className={s.specialName}>{sp.name}</span>
                <span className={s.specialMeal}>{sp.meals}</span>
                <span className={s.specialCount}>
                  <b>{c.total}</b> ordered of <b>{c.made}</b> made
                </span>
                <Chip size="xs" tone={tone}>
                  {c.left < 0 ? `${-c.left} over` : c.left === 0 ? 'Sold out' : `${c.left} left`}
                </Chip>
              </div>
              <MeterBar value={c.total} max={c.made} color={c.left < 0 ? CHART.bad : c.left <= 5 ? CHART.watch : CHART.good} />
              <div className={s.specialSplit}>
                {c.dine} dining room · {c.pickupDelivery} pick up and delivery · {c.associates} {c.associates === 1 ? 'associate' : 'associates'}
              </div>
            </li>
          );
        })}
      </ul>
      <p className={s.chartNote}>Made is the day's production count. Ordered counts every check rung in today and associate meals not cancelled.</p>
    </section>
  );
}

const dayTab = (a: number, today: boolean, i: number) =>
  today ? 'Today' : i === 1 ? 'Yesterday' : new Date(a).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

/** What residents said, day by day: what did well, what did poorly and what to do. */
function FeedbackByDay({ data }: { data: DashboardData }) {
  const days = data.recentFeedback.map((d, i) => ({ ...d, label: dayTab(d.a, d.today, i) })).filter((d) => d.count.n > 0);
  const [sel, setSel] = useState<string | null>(null);
  const [all, setAll] = useState(false);
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
      <div className={s.fbHead}>
        <h2 className={s.cardCap}>Resident feedback</h2>
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
      </div>
      <div className={s.highlight}>
        <Sparkles size={16} aria-hidden />
        <div>
          <div className={s.highlightCap}>Highlight</div>
          <div>{highlight}</div>
        </div>
      </div>
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
              <span className={cx(s.sentDot, s[`sent_${f.sent}`])} aria-label={f.sent === 'pos' ? 'Positive' : f.sent === 'neg' ? 'Negative' : 'Neutral'} />
              <div>
                <span className={s.commentWho}>{f.who || 'Resident'}</span>
                <span className={s.commentMeta}> · {[f.by, f.where, new Date(f.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })].filter(Boolean).join(' · ')}</span>
                <div className={s.commentText}>{f.text}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Below the trend cards: today's specials and today's feedback. */
export function TodayPanel({ data }: { data: DashboardData }) {
  return (
    <div className={s.today}>
      <BoCaption>Today</BoCaption>
      <div className={s.todayGrid}>
        <SpecialsMadeOrdered />
        <FeedbackByDay data={data} />
      </div>
    </div>
  );
}
