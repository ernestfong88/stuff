import { useState } from 'react';
import { formatTime } from '../../../../lib/format';
import { createSharedStore, useShared } from '../../../../lib/sharedStore';
import { Chip, cx } from '../../../../ui';
import { BarChart, BoCaption, CHART, ShareBar } from '../../kit';
import type { FeedbackItem, SentimentCount } from './model/feedback';
import { countSentiment, sentimentTrend } from './model/feedback';
import { dayLabel, longDay } from './model/periods';
import { sentimentAction, sentimentDay, sentimentWeek } from './model/sentiment';
import type { DashboardData } from './model/useDashboardData';
import { CardHead, DayModal, DirectionHead, Drivers, PeriodTrend, RangeModal, StartHere, TopAction } from './parts';
import s from './dashboard.module.css';

/** "Email me yesterday's summary" (a per-device preference until mail is wired up to accounts). */
const emailStore = createSharedStore<boolean>(false, { persistKey: 'kisco_backoffice_dash_email' });

const SENT_PARTS = (c: SentimentCount) => [
  { key: 'pos', name: 'Positive', value: c.pos, color: CHART.good },
  { key: 'neu', name: 'Neutral', value: c.neu, color: CHART.neutral },
  { key: 'neg', name: 'Negative', value: c.neg, color: CHART.bad },
];

function SentimentMix({ c }: { c: SentimentCount }) {
  return (
    <div className={s.block}>
      <div className={s.mixBoxes}>
        <div className={cx(s.mixBox, s.mixPos)}>
          <span className={s.mixN}>{c.pos}</span>Positive
        </div>
        <div className={cx(s.mixBox, s.mixNeu)}>
          <span className={s.mixN}>{c.neu}</span>Neutral
        </div>
        <div className={cx(s.mixBox, s.mixNeg)}>
          <span className={s.mixN}>{c.neg}</span>Negative
        </div>
      </div>
      {c.n > 0 && <ShareBar parts={SENT_PARTS(c)} legend={false} label="Comments" />}
    </div>
  );
}

function EmailToggle() {
  const on = useShared(emailStore);
  return (
    <label className={s.email}>
      <input type="checkbox" checked={on} onChange={(e) => emailStore.set(e.target.checked)} />
      Email me yesterday's summary at 6:00 AM
    </label>
  );
}

const VERDICT: Record<FeedbackItem['sent'], { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
  pos: { label: 'Liked', tone: 'success' },
  neu: { label: 'Neutral', tone: 'neutral' },
  neg: { label: 'Disliked', tone: 'danger' },
};

function CommentList({ items }: { items: FeedbackItem[] }) {
  const order = { neg: 0, neu: 1, pos: 2 };
  return (
    <ul className={s.comments}>
      {[...items]
        .sort((a, b) => order[a.sent] - order[b.sent] || b.at - a.at)
        .map((f) => (
          <li key={f.id} className={s.comment}>
            <Chip size="xs" tone={VERDICT[f.sent].tone}>
              {VERDICT[f.sent].label}
            </Chip>
            <div>
              <div className={s.commentText}>{f.text}</div>
              <div className={s.commentMeta}>{[f.dish, f.who, f.by, formatTime(f.at)].filter(Boolean).join(' · ')}</div>
            </div>
          </li>
        ))}
    </ul>
  );
}

/** Resident meal sentiment: the trend, daily comment bars and the top action. */
export function SentimentCard({ data }: { data: DashboardData }) {
  const [day, setDay] = useState<number | null>(null);
  const [range, setRange] = useState(false);
  const { n, sentimentDays: days, sentimentPeriods } = data;
  const c = countSentiment(days.flatMap((d) => d.items));
  const dir = sentimentTrend(c, sentimentPeriods[6]);
  const sub = { up: `More positive than the ${n} days before`, down: `More negative than the ${n} days before`, flat: `About the same as the ${n} days before`, none: 'Too few comments to compare' }[dir];
  const max = Math.max(1, ...days.map((d) => d.count.n));
  const action = sentimentAction(days);
  return (
    <article className={s.card}>
      <CardHead title="Resident meal sentiment" onDetail={() => setRange(true)} />
      <DirectionHead dir={dir} noneLabel="Not enough comments" sub={sub} />
      {c.n > 0 && <ShareBar parts={SENT_PARTS(c)} label={`Comments in the last ${n} days`} />}
      <div className={s.chart}>
        <BarChart
          label={`Comments per day, last ${n} days`}
          ceil={max}
          onSelect={setDay}
          data={days.map((d, i) => ({
            key: String(d.a),
            label: dayLabel({ a: d.a, i, today: d.today }, n),
            highlight: d.today,
            segments: d.count.n
              ? [
                  { value: d.count.pos, color: CHART.good, name: 'Positive' },
                  { value: d.count.neu, color: CHART.neutral, name: 'Neutral' },
                  { value: d.count.neg, color: CHART.bad, name: 'Negative' },
                ]
              : [],
            description: `${d.today ? 'Today' : longDay(d.a)}: ${d.count.n ? `${d.count.n} comments, ${d.count.pos} positive, ${d.count.neu} neutral, ${d.count.neg} negative` : 'no comments'}. Open for detail.`,
          }))}
        />
      </div>
      <TopAction {...action} onClick={() => setRange(true)} />
      {day != null && <SentimentDayModal data={data} index={day} setIndex={setDay} onClose={() => setDay(null)} />}
      {range && <SentimentRangeModal data={data} onClose={() => setRange(false)} />}
    </article>
  );
}

function SentimentDayModal({ data, index, setIndex, onClose }: { data: DashboardData; index: number; setIndex: (i: number) => void; onClose: () => void }) {
  const [all, setAll] = useState(false);
  const d = data.sentimentDays[index];
  const detail = sentimentDay(data.sentimentDays, index, data.n);
  return (
    <DayModal cap="Resident meal sentiment" dayTitle={(d.today ? 'Today, ' : '') + longDay(d.a)} index={index} count={data.sentimentDays.length} setIndex={setIndex} onClose={onClose}>
      <SentimentMix c={d.count} />
      {detail.insight ? <StartHere insight={detail.insight} /> : <p className={s.muted}>No comments captured this day. Servers add them with the mic on a check.</p>}
      {detail.alsoDisliked.length > 0 && (
        <div className={s.block}>
          <BoCaption>Also disliked</BoCaption>
          <ul className={s.lines}>
            {detail.alsoDisliked.map((o) => (
              <li key={o.dish} className={s.line}>
                <span className={s.lineName}>{o.dish}</span>
                <span className={s.lineWhat}>
                  {o.why}
                  {o.days > 1 ? ` · ${o.days} of last ${data.n} days` : ''}
                </span>
                <span className={cx(s.lineValue, s.bad)}>{o.n} disliked</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {detail.wentWell.length > 0 && (
        <div className={s.block}>
          <BoCaption>Went well</BoCaption>
          <p className={s.text}>{detail.wentWell.map((o) => `${o.dish} (${o.pos})`).join(', ')}</p>
        </div>
      )}
      {d.count.n > 0 && (
        <div className={s.block}>
          <button className={s.textLink} aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? 'Hide the comments' : `Read all ${d.count.n} comments`}
          </button>
          {all && <CommentList items={d.items} />}
        </div>
      )}
      <EmailToggle />
    </DayModal>
  );
}

function SentimentRangeModal({ data, onClose }: { data: DashboardData; onClose: () => void }) {
  const week = sentimentWeek(data.sentimentDays, data.sentimentPeriods, data.n);
  const c = countSentiment(data.sentimentDays.flatMap((d) => d.items));
  return (
    <RangeModal title="Resident meal sentiment" n={data.n} onClose={onClose}>
      <SentimentMix c={c} />
      <StartHere insight={week.insight} />
      <Drivers rows={week.drivers} />
      <PeriodTrend
        values={week.trend}
        n={data.n}
        todayStart={data.todayStart}
        format={String}
        isGood={(v) => v <= week.average}
        label="Negative comments"
        note="Bars count negative comments. Green is at or below the 8-period average."
      />
    </RangeModal>
  );
}
