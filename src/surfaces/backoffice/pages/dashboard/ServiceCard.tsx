import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { formatTime } from '../../../../lib/format';
import { Button, cx } from '../../../../ui';
import { BarChart, BoCaption, CHART } from '../../kit';
import { GOALS, TABLE_TIME_GOAL, min1, type Tone } from './model/insight';
import { dayLabel, longDay } from './model/periods';
import {
  avgTableTime,
  bestWorstTables,
  lateTablesByServer,
  serviceAction,
  serviceDayAction,
  serviceWeek,
  tableTime,
  type ServicePage,
  type TableRank,
  type TimedTable,
} from './model/service';
import type { DashboardData } from './model/useDashboardData';
import { CardHead, DayModal, DetailStat, Drivers, PeriodTrend, RangeModal, TopAction } from './parts';
import s from './dashboard.module.css';

/** Steps of Service: average table time against the goal, day by day. */
export function ServiceCard({ data, goto }: { data: DashboardData; goto: (pageId: string) => void }) {
  const [day, setDay] = useState<number | null>(null);
  const [range, setRange] = useState(false);
  const { n, days, servicePeriods } = data;
  const cur = servicePeriods[7];
  const perDay = days.map((d) => {
    const T = cur.filter((x) => x.day === d.a);
    return { ...d, T, v: avgTableTime(T) };
  });
  const ca = avgTableTime(cur);
  const pa = avgTableTime(servicePeriods[6]);
  const dr = ca != null && pa != null ? ca - pa : null;
  const dir = dr == null ? 'none' : dr < -0.5 ? 'up' : dr > 0.5 ? 'down' : 'flat';
  const sub = {
    up: `Faster than the ${n} days before`,
    down: `Slower than the ${n} days before`,
    flat: `About the same as the ${n} days before`,
    none: 'Too few tables to compare',
  }[dir];
  const vals = perDay.map((d) => d.v).filter((v): v is number => v != null);
  // Start the bars a little under the lowest day so differences of a minute or two are visible.
  const floor = Math.max(0, Math.floor(Math.min(TABLE_TIME_GOAL, ...vals) - 4));
  const ceil = Math.max(TABLE_TIME_GOAL + 3, ...vals);
  const action = serviceAction(cur);
  return (
    <article className={s.card}>
      <CardHead title="Steps of Service" onDetail={() => setRange(true)} />
      {/* The number that matters, big; how it is moving, small beside it. */}
      <div className={s.hero}>
        <div className={s.heroMain}>
          <span className={cx(s.heroValue, ca != null && ca > TABLE_TIME_GOAL ? s.bad : s.good)}>
            {min1(ca)}
            <span className={s.heroUnit}> min</span>
          </span>
          <span className={s.heroLabel}>average table time · goal {TABLE_TIME_GOAL} min</span>
        </div>
        <span className={cx(s.trendChip, dir === 'up' ? s.trendGood : dir === 'down' ? s.trendBad : s.trendFlat)} title={sub}>
          {dir === 'up' ? '▼' : dir === 'down' ? '▲' : '–'}{' '}
          {dr == null ? 'No trend yet' : dir === 'flat' ? 'Steady' : `${Math.abs(dr).toFixed(1)} min ${dir === 'up' ? 'faster' : 'slower'}`}
          <span className={s.trendVs}>vs the {n} days before</span>
        </span>
      </div>
      <div className={s.chart}>
        <BarChart
          label={`Average table time per day, last ${n} days`}
          floor={floor}
          ceil={ceil}
          goal={{ value: TABLE_TIME_GOAL, label: `Goal ${TABLE_TIME_GOAL} min` }}
          onSelect={setDay}
          data={perDay.map((d) => {
            const over = d.v != null && d.v > TABLE_TIME_GOAL;
            return {
              key: String(d.a),
              label: dayLabel(d, n),
              highlight: d.today,
              segments: d.v == null ? [] : [{ value: d.v, color: over ? CHART.bad : CHART.good, name: 'Table time' }],
              valueLabel: n > 14 || d.v == null ? undefined : min1(d.v),
              valueColor: over ? 'var(--danger)' : 'var(--green)',
              description:
                d.v == null
                  ? `${d.today ? 'Today' : longDay(d.a)}: no tables`
                  : `${d.today ? 'Today' : longDay(d.a)}: ${min1(d.v)} min average over ${d.T.length} tables, goal ${TABLE_TIME_GOAL}. Open to see the slowest tables.`,
            };
          })}
        />
      </div>
      {action && <TopAction {...action} onClick={() => setRange(true)} />}
      {day != null && <ServiceDayModal data={data} goto={goto} index={day} setIndex={setDay} onClose={() => setDay(null)} />}
      {range && <ServiceRangeModal data={data} goto={goto} onClose={() => setRange(false)} />}
    </article>
  );
}

function ServiceDayModal({
  data,
  goto,
  index,
  setIndex,
  onClose,
}: {
  data: DashboardData;
  goto: (pageId: string) => void;
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
}) {
  const d = data.days[index];
  const D = data.servicePeriods[7].filter((x) => x.day === d.a);
  const av = avgTableTime(D);
  const late = lateTablesByServer(D);
  const lateCount = late.reduce((q, g) => q + g.late.length, 0);
  const action = serviceDayAction(D);
  const slow = slowStep(D);
  return (
    <DayModal
      cap="Steps of Service"
      dayTitle={(d.today ? 'Today, ' : '') + longDay(d.a)}
      index={index}
      count={data.days.length}
      setIndex={setIndex}
      onClose={onClose}
    >
      {/* The next step first; the numbers that back it up after. */}
      <NextStep
        tone={action.tone}
        head={action.act}
        body={action.why}
        after={action.after}
        page={action.page}
        open={(id) => {
          onClose();
          goto(id);
        }}
      />
      <div className={s.dstats3}>
        <DetailStat
          value={`${min1(av)} min`}
          label={`average table time · goal ${TABLE_TIME_GOAL}`}
          tone={av != null && av > TABLE_TIME_GOAL ? 'bad' : 'good'}
        />
        <DetailStat value={`${lateCount} of ${D.length}`} label="tables over goal" tone={lateCount ? 'bad' : undefined} />
        {slow && (
          <DetailStat
            value={`${min1(slow.v)} of ${slow.goal} min`}
            label={`slowest step · ${slow.name}`}
            tone={slow.v > slow.goal ? 'bad' : 'good'}
          />
        )}
      </div>
      <BestWorst {...bestWorstTables(D)} />
      {late.length > 0 && (
        <div className={s.block}>
          <BoCaption>Who to follow up with</BoCaption>
          {late.map((g) => (
            <details key={g.server} className={s.follow}>
              <summary className={s.followHead}>
                <span className={s.followName}>{g.server}</span>
                <span className={s.followSub}>
                  {g.late.length} of {g.tables} over · mostly {g.cause === 'entrée' ? 'the entrée' : 'the appetizer'} · worst {g.late[0].table}{' '}
                  {min1(tableTime(g.late[0]))} min
                </span>
                <span className={s.followMore} aria-hidden>
                  <span className={s.whenShut}>Show tables</span>
                  <span className={s.whenOpen}>Hide tables</span>
                </span>
              </summary>
              <table className={s.followTable}>
                <tbody>
                  {g.late.map((x, j) => (
                    <tr key={j}>
                      <th scope="row">{x.table}</th>
                      <td className={s.followMeal}>
                        {x.meal} · {formatTime(x.at)}
                      </td>
                      <td className={s.bad}>
                        <b>{min1(tableTime(x))} min</b>
                      </td>
                      <td>
                        <span className={x.app > GOALS.app ? s.bad : s.neutralText}>Appetizer {min1(x.app)}</span>{' '}
                        <span className={x.ent > GOALS.ent ? s.bad : s.neutralText}>Entrée {min1(x.ent)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      )}
      <p className={s.chartNote}>
        Table time is the minutes from the order to the entrée served: {GOALS.app} to the appetizer plus {GOALS.ent} to the entrée.
      </p>
    </DayModal>
  );
}

/** The step furthest over its goal on a day: order → appetizer, or appetizer → entrée. */
function slowStep(D: TimedTable[]) {
  if (!D.length) return null;
  const aa = D.reduce((q, x) => q + x.app, 0) / D.length;
  const ae = D.reduce((q, x) => q + x.ent, 0) / D.length;
  return ae / GOALS.ent >= aa / GOALS.app
    ? { name: 'appetizer → entrée', v: ae, goal: GOALS.ent }
    : { name: 'order → appetizer', v: aa, goal: GOALS.app };
}

const PAGE_LABEL: Record<ServicePage, string> = { svcFlow: 'Pacing & Coursing' };
const PAGE_WHY: Record<ServicePage, string> = { svcFlow: 'when each course fires' };

/** "Do this next": the action, why, who after that, and the settings page that helps. */
function NextStep({
  tone,
  head,
  body,
  after,
  page,
  open,
}: {
  tone: Tone;
  head: string;
  body?: string;
  after?: string;
  page: ServicePage | null;
  open: (id: string) => void;
}) {
  return (
    <div className={cx(s.start, tone === 'good' ? s.startGood : s.startBad)}>
      <div className={s.startCap}>Do this next</div>
      <div className={s.startHead}>{head}</div>
      {body && <div className={s.startBody}>{body}</div>}
      {after && <div className={s.startBody}>{after}</div>}
      {page && (
        <div className={s.nextBtn}>
          <Button size="sm" iconRight={<ChevronRight size={14} />} onClick={() => open(page)}>
            {PAGE_LABEL[page]}
          </Button>
          <span className={s.muted}>{PAGE_WHY[page]}</span>
        </div>
      )}
    </div>
  );
}

function ServiceRangeModal({ data, goto, onClose }: { data: DashboardData; goto: (pageId: string) => void; onClose: () => void }) {
  const P = data.servicePeriods;
  const V = P.map((T) => avgTableTime(T) ?? 0);
  const dayAvgs = data.days.map((d) => avgTableTime(P[7].filter((x) => x.day === d.a)));
  const week = serviceWeek(P[7], avgTableTime(P[6]), dayAvgs, data.n);
  return (
    <RangeModal title="Steps of Service" n={data.n} onClose={onClose}>
      <NextStep
        tone={week.insight.tone}
        head={week.insight.head}
        body={week.insight.body}
        page={week.page}
        open={(id) => {
          onClose();
          goto(id);
        }}
      />
      <Drivers rows={week.drivers} />
      <BestWorst {...bestWorstTables(P[7], { byTable: true })} range />
      <PeriodTrend
        values={V.map((v) => +v.toFixed(1))}
        n={data.n}
        todayStart={data.todayStart}
        format={(v) => v.toFixed(1)}
        isGood={(v) => v <= TABLE_TIME_GOAL}
        goal={{ value: TABLE_TIME_GOAL, label: `Goal ${TABLE_TIME_GOAL} min` }}
        max={Math.max(TABLE_TIME_GOAL + 4, ...V)}
        label="Average table time"
        note={`Bars show average table time, order to entrée. Dashed line is the ${TABLE_TIME_GOAL} min goal.`}
      />
    </RangeModal>
  );
}

/** The slowest and fastest tables side by side: one day's visits, or each table's average over the range. */
function BestWorst({ worst, best, range }: { worst: TableRank[]; best: TableRank[]; range?: boolean }) {
  if (!worst.length) return null;
  const list = (title: string, rows: TableRank[], tone: 'bad' | 'good') => (
    <section className={s.rankCol} aria-label={title}>
      <BoCaption>{title}</BoCaption>
      <ol className={s.rankList}>
        {rows.map((x) => (
          <li key={x.table + (x.at ?? '')} className={s.rankRow}>
            <span className={s.rankTable}>{x.table}</span>
            <span className={s.rankSub}>
              {range ? `${x.visits} ${x.visits === 1 ? 'visit' : 'visits'}` : `${x.server?.split(' ')[0]} · ${x.meal} ${formatTime(x.at!)}`}
            </span>
            <b
              className={tone === 'bad' && x.minutes > TABLE_TIME_GOAL ? s.bad : tone === 'good' && x.minutes <= TABLE_TIME_GOAL ? s.good : undefined}
            >
              {min1(x.minutes)} min
            </b>
          </li>
        ))}
      </ol>
    </section>
  );
  return (
    <div className={s.rank}>
      {list(range ? 'Slowest tables · average' : 'Slowest tables', worst, 'bad')}
      {best.length > 0 && list(range ? 'Fastest tables · average' : 'Fastest tables', best, 'good')}
    </div>
  );
}
