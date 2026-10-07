import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button, Chip, cx } from '../../../../ui';
import { BarChart, BoCaption, BoTable, CHART } from '../../kit';
import { GOALS, money0 } from './model/insight';
import { dayLabel, longDay } from './model/periods';
import { budgetFor, budgetPct, madeByMeal, revenueAction, revenueDayInsight, revenueWeek, type Comp } from './model/revenue';
import type { DashboardData } from './model/useDashboardData';
import { CardHead, DayModal, DetailStat, Drivers, PeriodTrend, RangeModal, StartHere, TopAction } from './parts';
import s from './dashboard.module.css';

/** Revenue: made and comped against budget, with a running total chart. */
export function RevenueCard({ data, goto }: { data: DashboardData; goto: (pageId: string) => void }) {
  const [day, setDay] = useState<number | null>(null);
  const [range, setRange] = useState(false);
  const { n } = data;
  const cur = data.revenuePeriods[7];
  const onGoal = cur.pct <= GOALS.comp;
  let made = 0;
  let comped = 0;
  let budget = 0;
  const running = cur.days.map((d) => {
    made += d.made;
    comped += d.comp;
    budget += budgetFor(d.a);
    return { ...d, made: made, comped, budget };
  });
  const last = running[running.length - 1];
  const bp = budgetPct(last.made, last.budget);
  const action = revenueAction(cur, data.comps);
  return (
    <article className={s.card}>
      <CardHead title="Revenue" onDetail={() => setRange(true)} />
      <div className={s.money}>
        <div>
          <div className={s.moneyBig}>{money0(cur.made)}</div>
          <div className={s.moneyLabel}>Made</div>
        </div>
        <div>
          <div className={cx(s.moneyBig, s.clay)}>{money0(cur.comp)}</div>
          <div className={s.moneyLabel}>Comped</div>
        </div>
        <div className={s.moneyGoal}>
          <Chip size="xs" tone={onGoal ? 'success' : 'danger'}>
            {onGoal ? 'On goal' : 'Off goal'}
          </Chip>
          <div className={cx(s.moneyPct, onGoal ? s.good : s.bad)}>{cur.pct.toFixed(1)}%</div>
          <div className={s.moneyLabel}>comped · goal {GOALS.comp}%</div>
        </div>
      </div>
      <p className={s.cardLine}>
        Budget {money0(last.budget)} · <b className={bp >= 100 ? s.good : bp >= 95 ? s.clay : s.bad}>{bp}% of budget</b> ·{' '}
        {last.made >= last.budget ? `${money0(last.made - last.budget)} ahead` : `${money0(last.budget - last.made)} behind`}
      </p>
      <div className={s.legendRow}>
        <span>Running total · comped on top</span>
        <span className={s.budgetKey}>
          <span className={s.dash} aria-hidden /> Budget
        </span>
      </div>
      <div className={s.chart}>
        <BarChart
          label={`Running revenue and comps against budget, last ${n} days`}
          line={{ values: running.map((d) => d.budget), label: 'Budget' }}
          onSelect={setDay}
          data={running.map((d, i) => ({
            key: String(d.a),
            label: dayLabel({ a: d.a, i, today: i === running.length - 1 }, n),
            highlight: i === running.length - 1,
            segments: [
              { value: Math.max(0, d.made - d.comped), color: i === running.length - 1 ? CHART.madeNow : CHART.made, name: 'Made' },
              { value: d.comped, color: CHART.comped, name: 'Comped' },
            ],
            description: `Through ${new Date(d.a).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })}: ${money0(d.made)} made, ${money0(d.comped)} comped, budget ${money0(d.budget)}. That day ${money0(cur.days[i].made)} and ${money0(cur.days[i].comp)}. Open for detail.`,
          }))}
        />
      </div>
      <TopAction {...action} onClick={() => setRange(true)} />
      {day != null && <RevenueDayModal data={data} index={day} setIndex={setDay} onClose={() => setDay(null)} />}
      {range && <RevenueRangeModal data={data} goto={goto} onClose={() => setRange(false)} />}
    </article>
  );
}

const COMP_COLUMNS = [
  {
    key: 'item',
    header: 'Item',
    render: (c: Comp) => (
      <span>
        <b className={s.ink}>{c.item}</b>
        <span className={s.compSub}>
          {c.meal} · {c.resident}
        </span>
      </span>
    ),
  },
  { key: 'reason', header: 'Reason', render: (c: Comp) => c.reason },
  { key: 'server', header: 'Server', render: (c: Comp) => c.server },
  { key: 'by', header: 'Approved by', render: (c: Comp) => c.approvedBy },
  { key: 'amount', header: 'Amount', align: 'right' as const, render: (c: Comp) => <b className={s.ink}>{money0(c.amount)}</b> },
];

function RevenueDayModal({ data, index, setIndex, onClose }: { data: DashboardData; index: number; setIndex: (i: number) => void; onClose: () => void }) {
  const d = data.revenuePeriods[7].days[index];
  const isToday = index === data.days.length - 1;
  const comps = data.compsByDay[index];
  const pct = d.made ? (d.comp / d.made) * 100 : 0;
  return (
    <DayModal cap="Revenue" dayTitle={(isToday ? 'Today, ' : '') + longDay(d.a)} index={index} count={data.days.length} setIndex={setIndex} onClose={onClose}>
      <div className={s.dstats3}>
        <DetailStat value={money0(d.made)} label="made" />
        <DetailStat value={money0(d.comp)} label="comped" tone="clay" />
        <DetailStat value={`${pct.toFixed(1)}%`} label={`comped · goal ${GOALS.comp}%`} tone={pct > GOALS.comp ? 'bad' : 'good'} />
      </div>
      <StartHere insight={revenueDayInsight(d, comps, data.comps, data.n, isToday)} />
      {comps.length > 0 && (
        <div className={s.block}>
          <BoCaption>Every comp {isToday ? 'today' : 'this day'}</BoCaption>
          <BoTable caption="Comps" dense columns={COMP_COLUMNS} rows={comps} rowKey={(c) => c.item + c.reason + c.amount + c.server} rowTone={(c) => (c.reason !== 'Hospice' ? 'danger' : undefined)} />
        </div>
      )}
      {d.made > 0 && (
        <p className={s.text}>
          <b>Made by meal:</b> {madeByMeal(d)}
        </p>
      )}
    </DayModal>
  );
}

function RevenueRangeModal({ data, goto, onClose }: { data: DashboardData; goto: (pageId: string) => void; onClose: () => void }) {
  const P = data.revenuePeriods;
  const cur = P[7];
  const trend = P.map((p) => +p.pct.toFixed(1));
  const week = revenueWeek(cur, P[6], data.comps, trend, data.n);
  const bp = budgetPct(cur.made, cur.budget);
  return (
    <RangeModal title="Revenue" n={data.n} onClose={onClose}>
      <div className={s.dstats4}>
        <DetailStat value={money0(cur.made)} label="made" />
        <DetailStat value={money0(cur.comp)} label="comped" tone="clay" />
        <DetailStat value={`${cur.pct.toFixed(1)}%`} label={`comped · goal ${GOALS.comp}%`} tone={cur.pct > GOALS.comp ? 'bad' : 'good'} />
        <DetailStat value={`${bp}%`} label={`of the ${money0(cur.budget)} budget`} tone={bp >= 100 ? 'good' : bp >= 95 ? 'clay' : 'bad'} />
      </div>
      <StartHere insight={week.insight} />
      <Drivers rows={week.drivers} />
      <PeriodTrend
        values={trend}
        n={data.n}
        todayStart={data.todayStart}
        format={(v) => v.toFixed(1)}
        isGood={(v) => v <= GOALS.comp}
        goal={{ value: GOALS.comp, label: `Goal ${GOALS.comp}%` }}
        max={Math.max(GOALS.comp * 1.6, ...trend)}
        label="Comps as a share of revenue"
        note={`Bars show comps as % of revenue. Dashed line is the ${GOALS.comp}% goal.`}
      />
      <div>
        <Button
          size="sm"
          iconRight={<ChevronRight size={14} />}
          onClick={() => {
            onClose();
            goto('orders');
          }}
        >
          Order history
        </Button>
      </div>
    </RangeModal>
  );
}
