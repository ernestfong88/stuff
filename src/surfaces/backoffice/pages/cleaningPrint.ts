/**
 * The cleaning log on paper: a kitchen's week, task by task and day by day,
 * with who signed each one off. Printed from a hidden frame like the
 * production sheets.
 */
import { WEEKDAYS, dateOf, whenLabel, type LogCell, type WeekLogRow } from '../../../domain/cleaning';
import { formatTime } from '../../../lib/format';
import { crewMember } from '../../../store/cleaning';
import { esc, printHtml } from './productionPrint';

const CSS = `*{box-sizing:border-box}body{font-family:Georgia,"Times New Roman",serif;color:#1b2630;margin:24px}
h1{font-size:20px;margin:0 0 4px}.sub{color:#5e6b74;font-size:12px;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:11.5px}
td,th{padding:5px 5px;border:1px solid #bbb;text-align:left;vertical-align:top}th{font-size:10px;text-transform:uppercase;letter-spacing:.04em;background:#f2f2f2}
td.c{width:11%}.t{font-weight:bold}.w{color:#5e6b74;font-size:10px}.miss{color:#b23b2e;font-weight:bold}.na{background:#f6f6f6}
@page{size:landscape}`;

/** What a cell says: who signed it and when, or Missed, Overdue, Not yet; empty for days to come. */
export function cellText(c: LogCell | null): string {
  if (!c) return '';
  if (c.sign) return `${c.sign.by} ${formatTime(c.sign.at)}`;
  return c.status === 'missed' ? 'Missed' : c.status === 'overdue' ? 'Overdue' : c.status === 'upcoming' ? '' : 'Not yet';
}

export function cleaningLogHtml(venueName: string, weekLabel: string, weekIso: string, log: WeekLogRow[]): string {
  const days = WEEKDAYS.map((d, i) => {
    const date = dateOf(weekIso);
    date.setDate(date.getDate() + i);
    return `<th>${d.slice(0, 3)} ${date.getMonth() + 1}/${date.getDate()}</th>`;
  }).join('');
  const rows = log
    .map(({ task, cells }) => {
      const when = task.freq === 'daily' ? `Daily · ${whenLabel(task.when)}` : `Weekly · ${WEEKDAYS[task.day]}`;
      const who = crewMember(task.assignee)?.short ?? 'Anyone on shift';
      const tds = cells
        .map((c) =>
          c ? `<td class="c${c.status === 'missed' || c.status === 'overdue' ? ' miss' : ''}">${esc(cellText(c))}</td>` : '<td class="c na"></td>',
        )
        .join('');
      return `<tr><td><div class="t">${esc(task.text)}</div><div class="w">${esc(when)} · ${esc(who)}</div></td>${tds}</tr>`;
    })
    .join('');
  const title = `Cleaning log · ${venueName} · ${weekLabel}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body><h1>${esc(title)}</h1><div class="sub">Each task signed off with the cook's PIN</div><table><thead><tr><th>Task</th>${days}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function printCleaningLog(venueName: string, weekLabel: string, weekIso: string, log: WeekLogRow[]): void {
  printHtml(cleaningLogHtml(venueName, weekLabel, weekIso, log));
}
