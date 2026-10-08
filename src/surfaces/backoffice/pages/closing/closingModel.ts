/**
 * Back Office Closing Reports: one report per day and meal, built from the
 * same math as the manager's closing report (closingReport.ts), plus who
 * served, each server's totals, the comps and the sign-offs. Pure, so the
 * page, the printed copy, the export and the tests share it.
 */
import { DEFAULT_CONFIG, type DiningConfig } from '../../../../domain/config';
import { MEALS } from '../../../../domain/mealPeriods';
import { mealOf } from '../../../../domain/metrics/stepsOfService';
import { serverName } from '../../../../domain/servers';
import type { MealName, Order, ResidentNote } from '../../../../domain/types';
import { now } from '../../../../lib/clock';
import { formatDayLong, formatMoneyShort, formatTime, plural } from '../../../../lib/format';
import {
  TICKET_TIMES,
  checkMoney,
  feedbackSummary,
  formatMinutes,
  shiftMoney,
  ticketTimes,
  ticketWeek,
  type FeedbackSummary,
  type ShiftMoney,
  type TicketKey,
} from '../../../manager/shift/closingReport';
import type { SignOff } from '../../../manager/shift/signOff';
import { escapeHtml } from '../../../../lib/print';

export { MEALS };

/** Local midnight of the day of `t`, and of the day after (DST safe). */
export function dayBounds(t: number): { start: number; end: number } {
  const d = new Date(t);
  return {
    start: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
    end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(),
  };
}

/** Checks closed during the day starting at `start` that had someone at them. */
export function closedOn(history: Order[], start: number): Order[] {
  const { end } = dayBounds(start);
  return history.filter((o) => o.closedAt != null && o.closedAt >= start && o.closedAt < end && o.diners.length > 0);
}

/** How many checks closed at each meal that day, for the meal tabs. */
export function mealCounts(history: Order[], start: number): Record<MealName, number> {
  const out: Record<MealName, number> = { Breakfast: 0, Lunch: 0, Dinner: 0 };
  for (const o of closedOn(history, start)) out[mealOf(o)]++;
  return out;
}

/** The meal to open on: the one being served now (today), else the last meal of the day that closed checks. */
export function defaultMeal(counts: Record<MealName, number>, current: MealName | null): MealName {
  if (current) return current;
  return [...MEALS].reverse().find((m) => counts[m] > 0) ?? 'Dinner';
}

export interface ServerRow {
  /** Staff id, or '' for the pick up and delivery row. */
  id: string;
  name: string;
  checks: number;
  covers: number;
  charges: number;
  comps: number;
  compTotal: number;
  /** Still open on the floor (today only). */
  open: number;
  /** When the server signed off their own shift that day; undefined when not. */
  signedAt?: number;
}

export interface CompRow {
  key: string;
  table: string;
  server: string;
  who: string;
  reason: string;
  amt: number;
  at: number;
}

export interface TicketRow {
  key: TicketKey;
  label: string;
  value: number | null;
  /** The last seven of this meal, oldest first. */
  week: number[];
  last: number;
  avg: number;
  /** Minutes against the last of this meal: negative is faster. */
  delta: number | null;
}

export interface ShiftReport {
  meal: MealName;
  /** Closed checks of this meal, oldest first. */
  closed: Order[];
  /** Tables of this meal still open (today only). */
  open: Order[];
  money: ShiftMoney;
  tickets: TicketRow[];
  servers: ServerRow[];
  /** Pick up and delivery orders closed this meal, apart from the servers. */
  queue: ServerRow | null;
  comps: CompRow[];
  feedback: FeedbackSummary | null;
  /** Dining feedback comments that day. */
  fbCount: number;
}

export interface ShiftInput {
  history: Order[];
  /** Live checks; pass them only for today. */
  live: Order[];
  notes: ResidentNote[];
  /** Local midnight of the day. */
  start: number;
  meal: MealName;
  /** "YYYY-MM-DD", the key servers sign off under. */
  day: string;
  /** Server sign-offs, "AA|2026-10-08" -> when. */
  serverSignOffs: Record<string, number>;
  tableName: (o: Order) => string;
  /** How the feedback names the day: "today", "on Tuesday". */
  dayWord?: string;
  cfg?: DiningConfig;
}

const emptyRow = (id: string, name: string): ServerRow => ({ id, name, checks: 0, covers: 0, charges: 0, comps: 0, compTotal: 0, open: 0 });

/** __kBoClosing: the closing report for one meal of one day. */
export function shiftReport(x: ShiftInput): ShiftReport {
  const cfg = x.cfg ?? DEFAULT_CONFIG;
  const closed = closedOn(x.history, x.start)
    .filter((o) => mealOf(o) === x.meal)
    .sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));
  const open = x.live.filter((o) => !o.queueType && !o.closedAt && mealOf(o) === x.meal);
  const tables = closed.filter((o) => !o.queueType);
  const times = ticketTimes([...open, ...tables], cfg);
  const tickets: TicketRow[] = TICKET_TIMES.map((d) => {
    const week = ticketWeek(d.key, x.meal);
    const last = week[week.length - 1];
    const value = times[d.key];
    return {
      key: d.key,
      label: d.label,
      value,
      week,
      last,
      avg: week.reduce((n, v) => n + v, 0) / week.length,
      delta: value == null ? null : value - last,
    };
  });

  const rows = new Map<string, ServerRow>();
  let queue: ServerRow | null = null;
  const comps: CompRow[] = [];
  for (const o of closed) {
    const m = checkMoney(o, cfg);
    let row: ServerRow;
    if (o.queueType) row = queue ??= emptyRow('', 'Pick up and delivery');
    else {
      row = rows.get(o.server) ?? emptyRow(o.server, serverName(o.server));
      rows.set(o.server, row);
    }
    row.checks++;
    row.covers += o.diners.length;
    row.charges += m.charges.reduce((n, c) => n + c.amt, 0);
    row.comps += m.comps.length;
    row.compTotal += m.comps.reduce((n, c) => n + c.amt, 0);
    m.comps.forEach((c, i) =>
      comps.push({
        key: `${o.id}:${i}`,
        table: x.tableName(o),
        server: o.queueType ? '' : serverName(o.server),
        who: c.who,
        reason: c.reason,
        amt: c.amt,
        at: o.closedAt ?? 0,
      }),
    );
  }
  for (const o of open) {
    const row = rows.get(o.server) ?? emptyRow(o.server, serverName(o.server));
    rows.set(o.server, row);
    row.open++;
  }
  const servers = [...rows.values()]
    .map((r) => ({ ...r, signedAt: x.serverSignOffs[`${r.id}|${x.day}`] }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const { end } = dayBounds(x.start);
  const fb = x.notes.filter((n) => n.kind === 'fb' && n.at >= x.start && n.at < end);
  return {
    meal: x.meal,
    closed,
    open,
    money: shiftMoney(closed, cfg),
    tickets,
    servers,
    queue,
    comps,
    feedback: feedbackSummary(fb, x.dayWord),
    fbCount: fb.length,
  };
}

/** "Signed off by Dana Ruiz at 8:42 PM" or "Not signed off yet". */
export function signOffLine(signed: SignOff | null): string {
  return signed ? `Signed off by ${signed.by} at ${formatTime(signed.at)}` : 'Not signed off yet';
}

/** "4.2 min faster" than the last of this meal, or "No checks yet". */
export function deltaText(delta: number | null): string {
  if (delta == null) return 'No checks yet';
  return `${Math.abs(delta).toFixed(1)} min ${delta <= 0 ? 'faster' : 'slower'}`;
}

/** The text copy, in the manager's export format with the servers and comps added. */
export function exportText(r: ShiftReport, day: number, signed: SignOff | null): string {
  const m = r.money;
  return [
    `Closing report, ${formatDayLong(day)}, ${r.meal}`,
    `Servers: ${r.servers.map((x) => x.name).join(', ') || 'None'}`,
    '',
    `Total charges completed: ${formatMoneyShort(m.total)} (card ${formatMoneyShort(m.card)}, apartment ${formatMoneyShort(m.apt)})`,
    `Comps: ${m.comps}${m.comps ? ` (${formatMoneyShort(m.compTotal)})` : ''}`,
    `Checks closed: ${m.checks} (${m.covers} covers)`,
    ...(r.open.length ? [`Still open: ${plural(r.open.length, 'table')}`] : []),
    '',
    ...r.tickets.map((t) => `${t.label}: ${formatMinutes(t.value)}`),
    '',
    'By server:',
    ...[...r.servers, ...(r.queue ? [r.queue] : [])].map(
      (s) =>
        `  ${s.name}: ${plural(s.checks, 'check')}, ${plural(s.covers, 'cover')}, charges ${formatMoneyShort(s.charges)}` +
        (s.comps ? `, ${plural(s.comps, 'comp')} ${formatMoneyShort(s.compTotal)}` : '') +
        (s.id ? ` · ${s.signedAt ? `signed off ${formatTime(s.signedAt)}` : 'not signed off'}` : ''),
    ),
    ...(r.comps.length
      ? ['', 'Comps:', ...r.comps.map((c) => `  ${c.table} · ${c.who} · ${c.reason} · ${formatMoneyShort(c.amt)}${c.server ? ` (${c.server})` : ''}`)]
      : []),
    '',
    r.feedback ? r.feedback.head : 'No feedback recorded that day.',
    '',
    signed ? `Signed by ${signed.by} at ${formatTime(signed.at)}` : 'Not signed off yet',
  ].join('\n');
}

/** The body of the printed copy (wrap it with printableDocument). */
export function reportHtml(r: ShiftReport, day: number, signed: SignOff | null, community: string): string {
  const m = r.money;
  const e = escapeHtml;
  const tile = (v: string | number, l: string) => `<div class="tile"><b>${e(v)}</b>${e(l)}</div>`;
  const table = (head: string[], rows: string[][], num: number[] = []) =>
    `<table><thead><tr>${head.map((h, i) => `<th${num.includes(i) ? ' class="num"' : ''}>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows
      .map((row) => `<tr>${row.map((c, i) => `<td${num.includes(i) ? ' class="num"' : ''}>${e(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;
  const people = [...r.servers, ...(r.queue ? [r.queue] : [])];
  return (
    `<div class="kick">${e(community)} · Closing report</div>` +
    `<h1>${e(r.meal)} · ${e(formatDayLong(day))}</h1>` +
    `<div class="sub">${e(signOffLine(signed))}${r.open.length ? ` · ${e(plural(r.open.length, 'table'))} still open` : ''}</div>` +
    `<div class="tiles">${tile(formatMoneyShort(m.total), 'total charges')}${tile(formatMoneyShort(m.card), 'card')}${tile(formatMoneyShort(m.apt), 'apartment')}${tile(
      m.comps ? `${m.comps} · ${formatMoneyShort(m.compTotal)}` : '0',
      'comps',
    )}${tile(m.checks, 'checks closed')}${tile(m.covers, 'covers')}</div>` +
    `<h2>Ticket times</h2>` +
    table(
      ['Step', 'This shift', `Last ${r.meal.toLowerCase()}`, '7 day average'],
      r.tickets.map((t) => [t.label, formatMinutes(t.value), formatMinutes(t.last), formatMinutes(t.avg)]),
      [1, 2, 3],
    ) +
    `<h2>Servers</h2>` +
    (people.length
      ? table(
          ['Server', 'Checks', 'Covers', 'Charges', 'Comps', 'Signed off'],
          people.map((s) => [
            s.name,
            String(s.checks),
            String(s.covers),
            formatMoneyShort(s.charges),
            s.comps ? `${s.comps} · ${formatMoneyShort(s.compTotal)}` : '0',
            s.id ? (s.signedAt ? formatTime(s.signedAt) : 'Not signed off') : '',
          ]),
          [1, 2, 3, 4],
        )
      : '<p class="sub">No one served this meal.</p>') +
    `<h2>Comps</h2>` +
    (r.comps.length
      ? table(
          ['Table', 'Diner', 'Reason', 'Server', 'Amount'],
          r.comps.map((c) => [c.table, c.who, c.reason, c.server, formatMoneyShort(c.amt)]),
          [4],
        )
      : '<p class="sub">No comps this shift.</p>') +
    `<h2>Feedback that day</h2><p>${e(r.feedback ? r.feedback.head : 'No feedback recorded that day.')}</p>` +
    `<div class="ft">Printed ${e(formatTime(now()))}</div>`
  );
}
