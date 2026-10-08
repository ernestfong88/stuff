import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, Printer } from 'lucide-react';
import { COMMUNITY_NAME } from '../../../../data';
import { shiftMeal } from '../../../../domain/metrics/stepsOfService';
import type { MealName } from '../../../../domain/types';
import { startOfToday, today } from '../../../../lib/clock';
import { formatDayLong, formatMoneyShort, formatTime, plural } from '../../../../lib/format';
import { useShared } from '../../../../lib/sharedStore';
import { useConfig } from '../../../../store/config';
import { useDining } from '../../../../store/dining';
import { useTableName } from '../../../../store/floorLayout';
import { useNotes } from '../../../../store/notes';
import { Button, Tabs, cx } from '../../../../ui';
import { formatMinutes } from '../../../manager/shift/closingReport';
import { useSignOff } from '../../../manager/shift/signOff';
import { mealAt } from '../../../server/features/menu/menuSections';
import { printHtml, printableDocument } from '../../../server/features/shared/print';
import { signOffStore } from '../../../server/features/shift/shiftState';
import { BoIconButton, BoPage, BoSection, BoTable, type BoColumn } from '../../kit';
import { dayValue, parseDay } from '../../kit/dateRange';
import type { BoPageProps } from '../../nav';
import {
  MEALS,
  dayBounds,
  defaultMeal,
  deltaText,
  exportText,
  mealCounts,
  reportHtml,
  shiftReport,
  signOffLine,
  type CompRow,
  type ServerRow,
  type TicketRow,
} from './closingModel';
import s from './closing.module.css';

/** Closing Reports: each shift's closing report, any day, with the manager's and the servers' sign-offs. */
export default function ClosingPage(_props: BoPageProps) {
  const { orders, history } = useDining();
  const notes = useNotes();
  const cfg = useConfig();
  const tableName = useTableName();
  const serverSignOffs = useShared(signOffStore);

  const todayStart = startOfToday();
  const [start, setStart] = useState(todayStart);
  const [picked, setPicked] = useState<MealName | null>(null);
  const isToday = start === todayStart;
  const day = dayValue(start);

  const counts = useMemo(() => mealCounts(history, start), [history, start]);
  const live = isToday ? orders : [];
  const tables = live.filter((o) => !o.queueType && !o.closedAt);
  const meal = picked ?? defaultMeal(counts, isToday ? (tables.length ? shiftMeal(tables) : mealAt(today().getHours())) : null);
  const weekday = new Date(start).toLocaleDateString('en-US', { weekday: 'long' });
  const report = useMemo(
    () => shiftReport({ history, live, notes, start, meal, day, serverSignOffs, tableName, dayWord: isToday ? 'today' : `on ${weekday}`, cfg }),
    [history, live, notes, start, meal, day, serverSignOffs, tableName, isToday, weekday, cfg],
  );
  const signed = useSignOff(day, meal);
  const ml = meal.toLowerCase();
  const empty = report.closed.length === 0 && report.open.length === 0;

  const goDay = (t: number) => {
    setStart(Math.min(todayStart, dayBounds(t).start));
    setPicked(null);
  };

  const exportCopy = () => {
    const url = URL.createObjectURL(new Blob([exportText(report, start, signed)], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `closing-report-${day}-${ml}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const print = () => printHtml(printableDocument(`Closing report ${day} ${meal}`, reportHtml(report, start, signed, COMMUNITY_NAME)));

  return (
    <BoPage
      title="Closing Reports"
      sub="Each shift's closing report: sales, comps, ticket times, feedback and sign-offs"
      columns
      actions={
        <>
          <Button icon={<Printer size={15} />} onClick={print} disabled={empty}>
            Print
          </Button>
          <Button icon={<Download size={15} />} onClick={exportCopy} disabled={empty}>
            Export a copy
          </Button>
        </>
      }
    >
      <div className={s.filters}>
        <div className={s.group} role="group" aria-label="Day">
          <span className={s.groupLabel} aria-hidden>
            Day
          </span>
          <span className={s.datePick}>
            <BoIconButton aria-label="Previous day" onClick={() => goDay(start - 12 * 3_600_000)}>
              <ChevronLeft size={15} />
            </BoIconButton>
            <input
              type="date"
              className={s.date}
              aria-label="Day"
              max={dayValue(todayStart)}
              value={day}
              onChange={(e) => {
                const t = parseDay(e.target.value);
                if (t != null) goDay(t);
              }}
            />
            <BoIconButton aria-label="Next day" disabled={isToday} onClick={() => goDay(dayBounds(start).end)}>
              <ChevronRight size={15} />
            </BoIconButton>
            <span className={s.weekday}>{isToday ? 'Today' : weekday}</span>
            {!isToday && (
              <Button size="sm" variant="ghost" onClick={() => goDay(todayStart)}>
                Back to today
              </Button>
            )}
          </span>
        </div>
        <div className={s.group} role="group" aria-label="Meal">
          <span className={s.groupLabel} aria-hidden>
            Meal
          </span>
          <Tabs
            variant="segmented"
            size="sm"
            aria-label="Meal"
            value={meal}
            onChange={setPicked}
            options={MEALS.map((m) => ({ id: m, label: m, count: counts[m] || undefined }))}
          />
        </div>
      </div>

      {(!empty || signed) && <SignOffBanner signed={signed} open={report.open.length} servers={report.servers} meal={ml} />}

      {empty ? (
        <div className={s.empty}>
          <p className={s.emptyTitle}>
            No checks closed at {ml} on {formatDayLong(start)}.
          </p>
          <p className={s.emptyHint}>
            {isToday ? `Once ${ml} checks are closed on the tablets, they show up here.` : 'Pick another meal or day above.'}
          </p>
        </div>
      ) : (
        <>
          <div className={s.stats}>
            <Stat
              value={formatMoneyShort(report.money.total)}
              label="Total charges"
              tone="ocean"
              sub={`Card ${formatMoneyShort(report.money.card)} · apartment ${formatMoneyShort(report.money.apt)}`}
            />
            <Stat
              value={String(report.money.comps)}
              label={report.money.comps === 1 ? 'Comp' : 'Comps'}
              tone={report.money.comps ? 'clay' : undefined}
              sub={report.money.comps ? `${formatMoneyShort(report.money.compTotal)} total` : 'None'}
            />
            <Stat
              value={String(report.money.checks)}
              label="Checks closed"
              sub={plural(report.money.covers, 'cover') + (report.open.length ? ` · ${report.open.length} still open` : '')}
            />
          </div>

          <BoSection title="Ticket times" sub={`Against the last 7 ${ml}s`}>
            <BoTable caption="Ticket times" columns={ticketColumns(meal)} rows={report.tickets} rowKey={(t) => t.key} />
          </BoSection>

          <BoSection title="Servers" sub="Their totals and when each signed off their own shift">
            <BoTable
              caption="Servers"
              columns={SERVER_COLUMNS}
              rows={[...report.servers, ...(report.queue ? [report.queue] : [])]}
              rowKey={(r) => r.id || 'queue'}
              empty="No one served this meal."
            />
          </BoSection>

          <BoSection
            title="Comps"
            sub={report.comps.length ? `${plural(report.comps.length, 'comp')}, ${formatMoneyShort(report.money.compTotal)}` : undefined}
          >
            <BoTable caption="Comps" columns={COMP_COLUMNS} rows={report.comps} rowKey={(c) => c.key} empty="No comps this shift." />
          </BoSection>

          <BoSection title="Feedback that day" sub={report.fbCount ? plural(report.fbCount, 'comment') : undefined}>
            {report.feedback ? (
              <div className={s.feedback}>
                <p className={s.fbHead}>{report.feedback.head}</p>
                <div className={s.fbCols}>
                  <div>
                    <div className={cx(s.fbTitle, s.good)}>Going well</div>
                    {report.feedback.liked.length ? (
                      report.feedback.liked.slice(0, 3).map(([dish, n]) => (
                        <div key={dish} className={s.fbLine}>
                          {dish} · {n} positive
                        </div>
                      ))
                    ) : (
                      <div className={s.muted}>Nothing yet</div>
                    )}
                  </div>
                  <div>
                    <div className={cx(s.fbTitle, s.bad)}>To look at</div>
                    {report.feedback.issues.length ? (
                      report.feedback.issues.slice(0, 3).map((i) => (
                        <div key={i.key} className={s.fbLine}>
                          {i.label.charAt(0).toUpperCase() + i.label.slice(1)}
                          {i.dishes.length ? ` · ${i.dishes.join(', ')}` : ''}
                        </div>
                      ))
                    ) : (
                      <div className={s.muted}>Nothing flagged</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className={cx(s.muted, s.feedback)}>No feedback recorded that day.</p>
            )}
          </BoSection>
        </>
      )}

      <p className={s.footnote}>Sign-offs come from the manager and server tablets in this browser.</p>
    </BoPage>
  );
}

function SignOffBanner({ signed, open, servers, meal }: { signed: ReturnType<typeof useSignOff>; open: number; servers: ServerRow[]; meal: string }) {
  const waiting = servers.filter((r) => !r.signedAt).length;
  return (
    <div className={cx(s.banner, signed ? s.bannerDone : s.bannerWait)} role="status">
      {signed ? <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden /> : <Clock3 size={18} strokeWidth={2.5} aria-hidden />}
      <div className={s.bannerText}>
        <strong>{signOffLine(signed)}</strong>
        <span className={s.bannerSub}>
          {open ? `${plural(open, 'table')} still open at ${meal}. ` : ''}
          {servers.length
            ? waiting
              ? `${waiting} of ${plural(servers.length, 'server')} not signed off.`
              : `All ${plural(servers.length, 'server')} signed off.`
            : 'No servers this meal.'}
        </span>
      </div>
    </div>
  );
}

function Stat({ value, label, sub, tone }: { value: string; label: string; sub: string; tone?: 'ocean' | 'clay' }) {
  return (
    <div className={s.stat}>
      <div className={cx(s.statValue, tone && s[tone])}>{value}</div>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statSub}>{sub}</div>
    </div>
  );
}

function Sparkline({ week, value }: { week: number[]; value: number | null }) {
  const all = value == null ? week : [...week, value];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const W = 96;
  const H = 24;
  const step = W / week.length;
  const y = (v: number) => (hi === lo ? H / 2 : 3 + (1 - (v - lo) / (hi - lo)) * (H - 6));
  const pts = week.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className={s.spark} width={W + 6} height={H} viewBox={`0 0 ${W + 6} ${H}`} aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {value != null && (
        <>
          <line x1={(week.length - 1) * step} y1={y(week[week.length - 1])} x2={W} y2={y(value)} className={s.sparkLink} strokeDasharray="2 2" />
          <circle cx={W} cy={y(value)} r="3" className={s.sparkDot} />
        </>
      )}
    </svg>
  );
}

function ticketColumns(meal: MealName): Array<BoColumn<TicketRow>> {
  const ml = meal.toLowerCase();
  return [
    { key: 'label', header: 'Step', render: (t) => t.label },
    { key: 'value', header: 'This shift', align: 'right', render: (t) => <strong className={s.num}>{formatMinutes(t.value)}</strong> },
    { key: 'last', header: `Last ${ml}`, align: 'right', render: (t) => <span className={s.num}>{formatMinutes(t.last)}</span> },
    { key: 'avg', header: '7 day average', align: 'right', render: (t) => <span className={s.num}>{formatMinutes(t.avg)}</span> },
    { key: 'line', header: 'Last 7', render: (t) => <Sparkline week={t.week} value={t.value} /> },
    {
      key: 'delta',
      header: `Against last ${ml}`,
      render: (t) => <span className={cx(s.delta, t.delta != null && (t.delta <= 0 ? s.good : s.bad))}>{deltaText(t.delta)}</span>,
    },
  ];
}

const SERVER_COLUMNS: Array<BoColumn<ServerRow>> = [
  { key: 'name', header: 'Server', render: (r) => r.name },
  { key: 'checks', header: 'Checks', align: 'right', render: (r) => <span className={s.num}>{r.checks + (r.open ? ` + ${r.open} open` : '')}</span> },
  { key: 'covers', header: 'Covers', align: 'right', render: (r) => <span className={s.num}>{r.covers}</span> },
  { key: 'charges', header: 'Charges', align: 'right', render: (r) => <span className={s.num}>{formatMoneyShort(r.charges)}</span> },
  {
    key: 'comps',
    header: 'Comps',
    align: 'right',
    render: (r) => <span className={s.num}>{r.comps ? `${r.comps} · ${formatMoneyShort(r.compTotal)}` : '0'}</span>,
  },
  {
    key: 'signed',
    header: 'Signed off',
    render: (r) =>
      !r.id ? (
        <span className={s.muted}>No sign-off needed</span>
      ) : r.signedAt ? (
        formatTime(r.signedAt)
      ) : (
        <span className={s.amber}>Not signed off</span>
      ),
  },
];

const COMP_COLUMNS: Array<BoColumn<CompRow>> = [
  { key: 'table', header: 'Table', render: (c) => c.table },
  { key: 'who', header: 'Diner', render: (c) => c.who },
  { key: 'reason', header: 'Reason', render: (c) => c.reason },
  { key: 'server', header: 'Server', render: (c) => c.server || <span className={s.muted}>Pick up</span> },
  { key: 'amt', header: 'Amount', align: 'right', render: (c) => <span className={s.num}>{formatMoneyShort(c.amt)}</span> },
];
