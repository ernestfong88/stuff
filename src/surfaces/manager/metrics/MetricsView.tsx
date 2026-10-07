import { useState, type ReactNode } from 'react';
import { serverName } from '../../../domain/servers';
import type { MealName, Order } from '../../../domain/types';
import { startOfToday } from '../../../lib/clock';
import { plural } from '../../../lib/format';
import { useConfig } from '../../../store/config';
import { useDining } from '../../../store/dining';
import { Eyebrow, Tabs, cx, useNow } from '../../../ui';
import { useTableName } from '../../../store/floorLayout';
import {
  MEALS,
  atRisk,
  SOS_GOALS,
  byServer,
  demoSosTables,
  lastWeek,
  mealOf,
  minSec,
  missGoalPercent,
  missPercent,
  offGoal,
  shiftMeal,
  sosTable,
  summarize,
  weekLabels,
  type SosSample,
  type SosTable,
} from '../../../domain/metrics/stepsOfService';
import { Trend } from './Trend';
import s from './MetricsView.module.css';

const fmt1 = (v: number | null) => (v == null ? '–' : v.toFixed(1));

/** Averages use demo tables until this many checks this meal have a measured step. */
const LIVE_MIN = 3;

/** __KMetrics: Steps of Service for this meal against the last seven. */
export function MetricsView({ onOpen }: { onOpen: (o: Order) => void }) {
  const { orders, history } = useDining();
  const cfg = useConfig();
  useNow(15_000);
  const name = useTableName();
  const tables = orders.filter((o) => !o.queueType);
  const [meal, setMeal] = useState<MealName>(() => shiftMeal(tables));
  const t0 = startOfToday();
  const closedToday = history.filter((o) => !o.queueType && (o.closedAt ?? 0) >= t0);

  const live = [...tables, ...closedToday]
    .filter((o) => mealOf(o) === meal)
    .map((o) => sosTable(o, cfg))
    .filter((x): x is SosTable => x != null);
  const measured = live.filter((x) => x.done);
  const useDemo = measured.length < LIVE_MIN;
  const samples: SosSample[] = useDemo
    ? demoSosTables(new Date(t0)).filter((x) => x.meal === meal)
    : measured.map((x) => ({ app: x.app, ent: x.ent, ok: x.ok, server: x.order.server, table: name(x.order) }));
  const sum = summarize(samples);
  const week = lastWeek(meal);
  const labels = weekLabels();
  const missPct = missPercent(sum.missed, sum.n);
  const over = offGoal(sum.missed, sum.n);
  const ml = meal.toLowerCase();

  const risk = atRisk(tables.filter((o) => !o.closedAt), cfg);

  return (
    <div className={s.scroll}>
      <div className={s.head}>
        <h2 className={s.title}>Steps of Service</h2>
        <Tabs<MealName> variant="pills" size="md" value={meal} onChange={setMeal} aria-label="Meal" options={MEALS.map((m) => ({ id: m, label: m }))} />
        <span className={s.note}>
          {plural(sum.n, 'seated table')} · compared with the last 7 {ml}s
        </span>
      </div>

      <div className={s.cards}>
        <MetricCard
          highlight
          label={`Tables that missed a step this ${ml}`}
          value={`${Math.round(missPct)}%`}
          valueTone={over ? 'bad' : 'good'}
          after={`${sum.missed} of ${sum.n} tables · goal ${missGoalPercent()}% or less`}
          badge={over ? { bad: true, text: 'Off goal' } : { bad: false, text: 'On goal' }}
          note="A table misses when either step runs past its goal"
          trend={<Trend values={[...week.map((h) => (h.n ? (h.missed / h.n) * 100 : 0)), missPct]} tone={over ? 'bad' : 'good'} labels={labels} />}
        />
        <StepCard label="Order → appetizer" value={sum.app} goal={SOS_GOALS.app} late={sum.lateApp} history={week.map((h) => h.app)} meal={ml} labels={labels} />
        <StepCard label="Appetizer → entrée" value={sum.ent} goal={SOS_GOALS.ent} late={sum.lateEnt} history={week.map((h) => h.ent)} meal={ml} labels={labels} />
      </div>

      <Eyebrow className={s.section}>Help now · open tables near or past a step goal</Eyebrow>
      {!risk.length ? (
        <div className={s.allGood}>Every open table is on pace.</div>
      ) : (
        <div className={s.risks}>
          {risk.map((x) => {
            const past = x.elapsed > x.goal;
            return (
              <button key={x.order.id} className={cx(s.risk, past ? s.riskPast : s.riskSoon)} onClick={() => onOpen(x.order)}>
                <span className={s.riskHead}>
                  <span className={s.riskTable}>{name(x.order)}</span>
                  <span className={s.riskServer}>{serverName(x.order.server)}</span>
                  <span className={cx(s.riskState, past ? s.red : s.amber)}>{past ? 'Past goal' : 'Due soon'}</span>
                </span>
                <span className={s.riskStep}>
                  <span className={cx(s.stepName, past ? s.red : s.amber)}>{x.step}</span>
                  <span className={cx(s.stepTime, past ? s.red : s.amber)}>{minSec(x.elapsed)}</span>
                  <span className={s.stepOf}>
                    of {x.goal}:00 {x.from}
                  </span>
                </span>
                {x.why && (
                  <span className={s.riskWhy}>
                    <b>{x.why.text}</b>
                    <span className={s.who}> · {x.why.who}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Eyebrow className={s.section}>By server</Eyebrow>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Server</th>
              <th>Tables</th>
              <th>Missed</th>
              <th>Order → app ({SOS_GOALS.app})</th>
              <th>App → entrée ({SOS_GOALS.ent})</th>
            </tr>
          </thead>
          <tbody>
            {byServer(samples).map((r, i) => (
              <tr key={r.server} className={cx(i === 0 && r.missed > 0 && s.worst)}>
                <td className={s.strong}>{serverName(r.server)}</td>
                <td>{r.n}</td>
                <td className={cx(s.strong, r.missed ? s.red : s.green)}>{r.missed}</td>
                <td className={cx(r.app != null && r.app > SOS_GOALS.app && s.red)}>{fmt1(r.app)}</td>
                <td className={cx(r.ent != null && r.ent > SOS_GOALS.ent && s.red)}>{fmt1(r.ent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {useDemo && (
        <p className={s.demoNote}>
          Averages use demo tables until three checks this {ml} have both steps served. Help now uses the live tables.
        </p>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  valueTone?: 'good' | 'bad';
  after: string;
  badge: { bad: boolean; text: string };
  note: string;
  trend: ReactNode;
  highlight?: boolean;
}

function MetricCard({ label, value, valueTone, after, badge, note, trend, highlight }: MetricCardProps) {
  return (
    <div className={cx(s.card, highlight && s.highlight)}>
      <div className={s.cardTop}>
        <span className={s.cardLabel}>{label}</span>
        <span className={cx(s.badge, badge.bad ? s.badgeBad : s.badgeGood)}>{badge.text}</span>
      </div>
      <div className={s.cardValueRow}>
        <span className={cx(s.cardValue, highlight && s.cardValueBig, valueTone === 'bad' && s.red, valueTone === 'good' && s.green)}>{value}</span>
        <span className={s.cardAfter}>{after}</span>
      </div>
      <div className={s.cardNote}>{note}</div>
      {trend}
    </div>
  );
}

function StepCard(p: { label: string; value: number | null; goal: number; late: number; history: Array<number | null>; meal: string; labels: string[] }) {
  const bad = p.value != null && p.value > p.goal;
  return (
    <MetricCard
      label={p.label}
      value={fmt1(p.value)}
      valueTone={bad ? 'bad' : undefined}
      after={`of ${p.goal} min`}
      badge={p.late ? { bad: true, text: `${p.late} late` } : { bad: false, text: 'none late' }}
      note={`Average this ${p.meal} vs the last 7 ${p.meal}s`}
      trend={<Trend values={[...p.history, p.value]} tone={bad ? 'bad' : 'good'} labels={p.labels} />}
    />
  );
}
