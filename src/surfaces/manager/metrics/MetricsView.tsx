import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { serverName } from '../../../domain/servers';
import type { MealName, Order } from '../../../domain/types';
import { startOfToday } from '../../../lib/clock';
import { useConfig } from '../../../store/config';
import { useDiningHistory, useDiningOrders } from '../../../store/dining';
import { useTableName } from '../../../store/floorLayout';
import { Tabs, cx, useNow } from '../../../ui';
import { MEALS, SOS_GOALS, atRisk, demoSosTables, lastWeek, mealOf, minSec, offGoal, shiftMeal, summarize } from '../../../domain/metrics/stepsOfService';
import { STEPS, demoRow, goalOf, isLate, nextStep, serverRows, sortRows, stepSummary, timedRow, valueOf, type StepStat, type TimedRow } from './sosView';
import { TABLE_TIME_GOAL, tableTimeOf, tableTimeTrend } from './tableTime';
import s from './MetricsView.module.css';

const fmt1 = (v: number | null) => (v == null ? '–' : v.toFixed(1));

/** Averages use demo tables until this many checks this meal have a measured step. */
const LIVE_MIN = 3;

/**
 * __KMetrics: Steps of Service for one meal today. One headline (average
 * table time against its goal), the steps in the order they happen, one thing
 * to do next, then by server and, folded away, every timed table.
 */
export function MetricsView({ onOpen }: { onOpen: (o: Order) => void }) {
  const orders = useDiningOrders();
  const history = useDiningHistory();
  const cfg = useConfig();
  useNow(15_000);
  const name = useTableName();
  const tables = orders.filter((o) => !o.queueType);
  const [meal, setMeal] = useState<MealName>(() => shiftMeal(tables));
  const [who, setWho] = useState<string | null>(null);
  const [showTables, setShowTables] = useState(false);
  const t0 = startOfToday();
  const closedToday = history.filter((o) => !o.queueType && (o.closedAt ?? 0) >= t0);

  const live = [...tables, ...closedToday]
    .filter((o) => mealOf(o) === meal)
    .map((o) => timedRow(o, name(o), cfg))
    .filter((x): x is TimedRow => x != null);
  const measured = live.filter((x) => x.app != null || x.ent != null);
  const useDemo = measured.length < LIVE_MIN;
  const rows = useDemo ? demoSosTables(new Date(t0)).filter((x) => x.meal === meal).map(demoRow) : measured;
  const sum = summarize(rows);
  const tt = tableTimeOf(sum);
  const trend = tableTimeTrend(tt, lastWeek(meal));
  const steps = stepSummary(rows);
  const servers = serverRows(rows);
  const risk = atRisk(tables.filter((o) => !o.closedAt && mealOf(o) === meal), cfg);
  const next = nextStep(risk, servers, tt, name);
  const ml = meal.toLowerCase();
  const onTime = sum.n - sum.missed;
  const over = offGoal(sum.missed, sum.n);
  const listed = sortRows((useDemo ? rows : live).filter((r) => !who || r.server === who));
  const timedCount = listed.filter((r) => r.app != null || r.ent != null).length;
  const pickServer = (id: string) => {
    setWho(who === id ? null : id);
    if (who !== id) setShowTables(true);
  };

  return (
    <div className={s.scroll} data-metrics>
      <div className={s.head}>
        <h2 className={s.title}>Steps of Service</h2>
        <Tabs<MealName>
          variant="pills"
          size="lg"
          value={meal}
          onChange={(m) => {
            setMeal(m);
            setWho(null);
          }}
          aria-label="Meal"
          options={MEALS.map((m) => ({ id: m, label: m }))}
        />
      </div>

      {/* 1. The headline: average table time against its goal. */}
      <section className={s.hero} aria-label="Average table time">
        <div className={s.heroMain}>
          <span className={s.cap}>Average table time · {ml} today</span>
          <span className={cx(s.heroValue, tt == null ? undefined : tt > TABLE_TIME_GOAL ? s.red : s.green)}>
            {fmt1(tt)}
            <span className={s.heroUnit}> min</span>
          </span>
          <span className={s.muted}>
            Order to entrée · goal {TABLE_TIME_GOAL} min or less
          </span>
        </div>
        <div className={s.heroSide}>
          <span className={s.onTime}>
            <b className={sum.n ? (over ? s.red : s.green) : undefined}>
              {onTime} of {sum.n}
            </b>{' '}
            tables got their food on time
          </span>
          <span className={s.muted}>
            On time: appetizer within {SOS_GOALS.app} min and entrée within {SOS_GOALS.ent}. Goal {SOS_GOALS.sos}% of tables.
          </span>
          <span className={cx(s.trendChip, trend.dir === 'faster' ? s.trendGood : trend.dir === 'slower' ? s.trendBad : s.trendFlat)}>
            {trend.dir === 'faster' ? '▼' : trend.dir === 'slower' ? '▲' : '–'}{' '}
            {trend.delta == null ? 'No trend yet' : trend.dir === 'steady' ? 'About the same' : `${Math.abs(trend.delta).toFixed(1)} min ${trend.dir}`}
            <span className={s.trendVs}> than the last 7 {ml}s</span>
          </span>
        </div>
      </section>

      {/* 2. The steps in the order they happen, each against its goal. */}
      <section className={s.card} aria-label="Step by step">
        <h3 className={s.h}>
          Step by step <span className={s.hNote}>average minutes this {ml}; the outline is the goal</span>
        </h3>
        <StepBars steps={steps} meal={ml} />
      </section>

      {/* 3. One thing to do. */}
      <div className={cx(s.next, s[`next_${next.tone}`])}>
        <span className={s.nextCap}>Do this next</span>
        {next.order ? (
          <button className={s.nextAct} onClick={() => onOpen(next.order!)}>
            {next.act}
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ) : (
          <span className={s.nextAct}>{next.act}</span>
        )}
        <span className={s.nextWhy}>{next.why}</span>
        {next.also.length > 0 && (
          <span className={s.also}>
            <span className={s.muted}>Then:</span>
            {next.also.map((x) => (
              <button key={x.order.id} className={cx(s.alsoChip, x.elapsed > x.goal ? s.alsoPast : s.alsoSoon)} onClick={() => onOpen(x.order)}>
                {name(x.order)} · {x.step.toLowerCase()} {minSec(x.elapsed)}
              </button>
            ))}
          </span>
        )}
      </div>

      {/* 4. By server, the most late tables first. */}
      <section aria-label="By server">
        <h3 className={s.h}>
          By server <span className={s.hNote}>tap a server to see their tables</span>
        </h3>
        <div className={s.list}>
          <div className={cx(s.srow, s.listHead)} aria-hidden="true">
            <span>Server</span>
            <span>On time</span>
            <span>Average</span>
            <span>Slowest step</span>
            <span>Worst table</span>
          </div>
          {servers.map((r) => {
            const late = r.n - r.onTime;
            return (
              <button key={r.server} className={cx(s.srow, who === r.server && s.picked)} aria-pressed={who === r.server} onClick={() => pickServer(r.server)}>
                <span className={s.sName}>{serverName(r.server)}</span>
                <span>
                  <b className={late ? s.red : s.green}>
                    {r.onTime} of {r.n}
                  </b>
                  <span className={s.lbl}> on time</span>
                </span>
                <span>
                  <span className={s.lbl}>Average </span>
                  <b className={r.avg != null && r.avg > TABLE_TIME_GOAL ? s.red : undefined}>{fmt1(r.avg)} min</b>
                </span>
                <span>
                  <span className={s.lbl}>Slowest </span>
                  {r.slowest ? (
                    <>
                      {STEPS.find((x) => x.key === r.slowest!.key)!.short}{' '}
                      <b className={r.slowest.avg > r.slowest.goal ? s.red : undefined}>{r.slowest.avg.toFixed(1)}</b>
                      <span className={s.muted}> / {r.slowest.goal}</span>
                    </>
                  ) : (
                    '–'
                  )}
                </span>
                <span>
                  <span className={s.lbl}>Worst </span>
                  {r.worst ? (
                    <>
                      <b>{r.worst.table}</b> · {STEPS.find((x) => x.key === r.worst!.key)!.noun} <b className={s.red}>{r.worst.mins.toFixed(1)}</b>
                    </>
                  ) : (
                    <span className={s.green}>None late</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Every timed table, folded away. */}
      <section aria-label="Tables">
        <div className={s.tablesHead}>
          <button className={s.disclosure} aria-expanded={showTables} onClick={() => setShowTables(!showTables)}>
            {showTables ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
            {who ? `${serverName(who)}’s tables` : 'Every table'}
            <span className={s.hNote}>
              {timedCount} timed{listed.length > timedCount ? `, ${listed.length - timedCount} still waiting on food` : ''}
            </span>
          </button>
          {who && (
            <button className={s.clear} onClick={() => setWho(null)}>
              Show every server
            </button>
          )}
        </div>
        {showTables && (
          <div className={s.list}>
            <div className={cx(s.trow, s.listHead)} aria-hidden="true">
              <span>Table</span>
              {STEPS.map((x) => (
                <span key={x.key}>{x.short}</span>
              ))}
            </div>
            {listed.map((r, i) =>
              r.order ? (
                <button key={r.order.id} className={s.trow} onClick={() => onOpen(r.order!)}>
                  <TableCells r={r} />
                </button>
              ) : (
                <div key={i} className={s.trow}>
                  <TableCells r={r} />
                </div>
              ),
            )}
            {!listed.length && <div className={s.empty}>No tables timed yet.</div>}
          </div>
        )}
      </section>

      {useDemo && <p className={s.demoNote}>Averages use demo tables until three checks this {ml} have a food step served.</p>}
    </div>
  );
}

/** The stepped bar: each step starts where the one before it ends, on one minute scale. */
function StepBars({ steps, meal }: { steps: StepStat[]; meal: string }) {
  const end = Math.max(10, ...steps.map((x) => x.start + Math.max(x.avg ?? 0, x.goal ?? 0)));
  const scale = Math.ceil(end / 5) * 5;
  const tick = scale > 30 ? 10 : 5;
  const pc = (v: number) => `${(v / scale) * 100}%`;
  return (
    <div className={s.steps}>
      {steps.map((x) => (
        <div key={x.key} className={cx(s.step, x.slowest && (x.tone === 'bad' ? s.stepBad : s.stepWarn))}>
          <span className={s.stepName}>
            {x.name}
            {x.slowest && <span className={cx(s.slowTag, x.tone === 'bad' ? s.slowBad : s.slowWarn)}>Slowest step</span>}
          </span>
          <span className={s.track} aria-hidden="true">
            {x.goal != null && x.avg != null && <span className={s.goalZone} style={{ left: pc(x.start), width: pc(x.goal) }} />}
            {x.avg != null && <span className={cx(s.bar, s[`bar_${x.tone}`])} style={{ left: pc(x.start), width: pc(x.avg) }} />}
          </span>
          <span className={s.stepVal}>
            {x.avg == null ? (
              <span className={s.muted}>{x.key === 'greet' ? `Not timed at ${meal}` : 'No times yet'}</span>
            ) : (
              <>
                <b className={x.tone === 'bad' ? s.red : x.tone === 'warn' ? s.amber : x.tone === 'good' ? s.green : undefined}>{x.avg.toFixed(1)} min</b>
                <span className={s.muted}>
                  {x.goal != null ? ` · goal ${x.goal}` : ' · no goal'}
                  {x.late > 0 && ` · ${x.late} late`}
                </span>
              </>
            )}
          </span>
        </div>
      ))}
      <div className={s.axis} aria-hidden="true">
        <span />
        <span className={s.axisTrack}>
          {Array.from({ length: scale / tick + 1 }, (_, i) => (
            <span key={i} className={s.axisTick} style={{ left: pc(i * tick) }}>
              {i === 0 ? 'Seated' : i * tick}
            </span>
          ))}
        </span>
        <span className={s.muted}>min after seated</span>
      </div>
    </div>
  );
}

function TableCells({ r }: { r: TimedRow }) {
  return (
    <>
      <span className={s.tName}>
        <b>{r.table}</b> <span className={s.muted}>{serverName(r.server)}</span>
      </span>
      {STEPS.map((x) => {
        const v = valueOf(r, x.key);
        const run = r.running?.key === x.key ? r.running : null;
        const late = isLate(r, x.key);
        return (
          <span key={x.key} className={s.tCell}>
            <span className={s.lbl}>{x.short} </span>
            {run ? (
              <>
                <span className={cx(s.val, run.elapsed > run.goal ? s.lateVal : run.elapsed >= run.goal - 2 ? s.soonVal : undefined)}>{minSec(run.elapsed)}</span>
                <span className={s.muted}> so far</span>
              </>
            ) : v == null ? (
              <span className={s.muted}>–</span>
            ) : (
              <span className={cx(s.val, late && s.lateVal)} title={late ? `Goal ${goalOf(r, x.key)} min` : undefined}>
                {v.toFixed(1)}
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}
