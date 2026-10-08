/**
 * The temperature log on paper: a kitchen's day, meal by meal and dish by
 * dish, with each reading, who took it and when, and what was done when one
 * was out of range. Printed from a hidden frame like the production sheets.
 */
import { dateOf } from '../../../domain/cleaning';
import {
  ACTION_LABEL,
  COLD_HOLD_F,
  COOK_MIN_F,
  EXTRA_REASON_LABEL,
  HOT_HOLD_F,
  SERVICE,
  clockLabel,
  formatTemp,
  mealChecks,
  type CookKind,
  type HoldType,
  type TempCell,
  type TempExtraCell,
} from '../../../domain/tempLog';
import { formatTime } from '../../../lib/format';
import type { MealLog } from '../../../store/tempLog';
import { esc, printHtml } from './productionPrint';

/** "Today", "Yesterday" or "Tue Oct 6". */
export function dayName(iso: string, back: number): string {
  if (back === 0) return 'Today';
  if (back === 1) return 'Yesterday';
  return dateOf(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
}

/** "Hot · ≥ 165°F on the line, then ≥ 135°F", "Hot · ≥ 135°F" or "Cold · ≤ 41°F". */
export function holdRule(hold: HoldType, cook: CookKind): string {
  if (hold === 'none') return 'Not logged';
  if (hold === 'cold') return `Cold · ≤ ${COLD_HOLD_F}°F`;
  return COOK_MIN_F[cook] > HOT_HOLD_F ? `Hot · ≥ ${COOK_MIN_F[cook]}°F on the line, then ≥ ${HOT_HOLD_F}°F` : `Hot · ≥ ${HOT_HOLD_F}°F`;
}

/** What a cell says: the reading, who and when, and the action taken; or Missed, Overdue, Not yet. */
export function tempCellText(c: TempCell): string {
  const r = c.reading;
  if (!r) return c.status === 'missed' ? 'Missed' : c.status === 'overdue' ? 'Overdue' : c.status === 'upcoming' ? '' : 'Not yet';
  const fix =
    c.status === 'out'
      ? ` · ${r.action ? ACTION_LABEL[r.action] : 'no action'}${r.recheckF != null ? `, recheck ${formatTemp(r.recheckF)}` : ''}`
      : '';
  return `${formatTemp(r.tempF)} ${r.by} ${formatTime(r.at)}${fix}`;
}

/** What an extra check says: "152°F Re-check G. Kim 6:52 PM", and the action taken when out of range. */
export function tempExtraText(x: TempExtraCell): string {
  const r = x.reading;
  const fix =
    x.status === 'out'
      ? ` · ${r.action ? ACTION_LABEL[r.action] : 'no action'}${r.recheckF != null ? `, recheck ${formatTemp(r.recheckF)}` : ''}`
      : '';
  return `${formatTemp(r.tempF)} ${r.reason ? EXTRA_REASON_LABEL[r.reason] : 'Extra'} ${r.by} ${formatTime(r.at)}${fix}`;
}

const CSS = `*{box-sizing:border-box}body{font-family:Georgia,"Times New Roman",serif;color:#1b2630;margin:24px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:16px 0 6px}.sub{color:#5e6b74;font-size:12px;margin-bottom:8px}table{width:100%;border-collapse:collapse;font-size:11.5px}
td,th{padding:5px 5px;border:1px solid #bbb;text-align:left;vertical-align:top}th{font-size:10px;text-transform:uppercase;letter-spacing:.04em;background:#f2f2f2}
td.c{width:30%}td.x div+div{margin-top:3px}.t{font-weight:bold}.w{color:#5e6b74;font-size:10px}.miss{color:#b23b2e;font-weight:bold}`;

export function tempLogHtml(venueName: string, dayLabel: string, iso: string, logs: MealLog[]): string {
  const date = dateOf(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const meals = logs
    .filter((l) => l.dishes.length)
    .map((l) => {
      const checks = mealChecks(l.meal);
      const anyExtra = l.dishes.some((d) => d.extras.length);
      const head = checks.map((c) => `<th>${esc(c.label)} ${esc(clockLabel(c.due))}</th>`).join('') + (anyExtra ? '<th>Extra checks</th>' : '');
      const rows = l.dishes
        .map(({ dish, cells, extras }) => {
          const tds = cells
            .map(
              (c) =>
                `<td class="c${c.status === 'out' || c.status === 'missed' || c.status === 'overdue' ? ' miss' : ''}">${esc(tempCellText(c))}</td>`,
            )
            .join('');
          const xtd = anyExtra
            ? `<td class="x">${extras.map((x) => `<div${x.status === 'out' ? ' class="miss"' : ''}>${esc(tempExtraText(x))}</div>`).join('') || 'None'}</td>`
            : '';
          return `<tr><td><div class="t">${esc(dish.name)}</div><div class="w">${esc(holdRule(dish.hold, dish.cook))}</div></td>${tds}${xtd}</tr>`;
        })
        .join('');
      const { start, end } = SERVICE[l.meal];
      return `<h2>${esc(l.meal)} · ${esc(clockLabel(start))} to ${esc(clockLabel(end))}</h2><table><thead><tr><th>Dish</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join('');
  const title = `Temperature log · ${venueName} · ${dayLabel}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body><h1>${esc(title)}</h1><div class="sub">${esc(date)} · each reading signed with the cook's PIN · hot ≥ ${HOT_HOLD_F}°F, cold ≤ ${COLD_HOLD_F}°F</div>${meals}</body></html>`;
}

export function printTempLog(venueName: string, dayLabel: string, iso: string, logs: MealLog[]): void {
  printHtml(tempLogHtml(venueName, dayLabel, iso, logs));
}
