/**
 * Production sheets for the kitchen: a day's (or a week's) counts by meal, and each
 * special that has a recipe scaled to its count. Printed from a hidden
 * frame so the back office page itself never goes to the printer.
 */
import { productionCount, recipeFor, type ProductionDay, type ProductionState } from '../../../store/production';

const esc = (t: string | number) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** Quantities on a sheet round to the nearest quarter. */
const quarter = (q: number) => String(Math.max(0.25, Math.round(q * 4) / 4));

const CSS = `*{box-sizing:border-box}body{font-family:Georgia,"Times New Roman",serif;color:#1b2630;margin:28px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:22px 0 6px;border-bottom:2px solid #1b2630;padding-bottom:3px}
h3{font-size:15px;margin:18px 0 4px}.sub{color:#5e6b74;font-size:12px}table{width:100%;border-collapse:collapse;font-size:13px}
td,th{padding:5px 6px;border-bottom:1px solid #ccc;text-align:left}th{font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.n{text-align:right;font-variant-numeric:tabular-nums}.sheet{page-break-before:always}ol{padding-left:18px}`;

/** One day's counts by meal, then a scaled recipe sheet per special. */
function dayHtml(venueName: string, dayLabel: string, day: ProductionDay, state: ProductionState, venueId: string, first: boolean): string {
  const meals = [...new Set(day.rows.map((r) => r.meal))];
  const counts = meals
    .map((meal) => {
      const rows = day.rows
        .filter((r) => r.meal === meal)
        .map((r) => {
          const c = productionCount(state, venueId, day.iso, r);
          return `<tr><td>${esc(r.name)}</td><td class="n">${esc(c.make)}${r.unit ? ' ' + esc(r.unit) : ''}</td><td class="n">${r.entree ? esc(c.assoc ?? 0) : ''}</td><td>${c.ok ? 'Confirmed' : 'Not confirmed'}</td></tr>`;
        })
        .join('');
      return `<h2>${esc(meal)}</h2><table><thead><tr><th>Item</th><th class="n">Make</th><th class="n">Associates</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join('');
  const sheets = day.rows
    .filter((r) => r.kind === 'special' && recipeFor(r.name))
    .map((r) => {
      const recipe = recipeFor(r.name)!;
      const make = productionCount(state, venueId, day.iso, r).make;
      const f = make / recipe.base;
      const items = recipe.ingredients.map(([q, u, w]) => `<tr><td class="n">${quarter(q * f)}${u ? ' ' + esc(u) : ''}</td><td>${esc(w)}</td></tr>`).join('');
      const steps = recipe.method.map((m) => `<li>${esc(m)}</li>`).join('');
      return `<section class="sheet"><h1>${esc(r.name)} · make ${esc(make)}</h1><div class="sub">${esc(dayLabel)} · ${esc(r.meal)} · base recipe ${recipe.base} · one serving = ${esc(recipe.serving)}</div><h3>Ingredients</h3><table><tbody>${items}</tbody></table><h3>Method</h3><ol>${steps}</ol></section>`;
    })
    .join('');
  const title = `Production · ${venueName} · ${dayLabel}`;
  return `<section${first ? '' : ' class="sheet"'}><h1>${esc(title)}</h1><div class="sub">${esc(day.date.toDateString())}${day.cycleDay ? ' · cycle day ' + day.cycleDay : ''}</div>${counts}</section>${sheets}`;
}

function documentHtml(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

export function productionSheetsHtml(venueName: string, dayLabel: string, day: ProductionDay, state: ProductionState, venueId: string): string {
  return documentHtml(`Production · ${venueName} · ${dayLabel}`, dayHtml(venueName, dayLabel, day, state, venueId, true));
}

/** A week of production: each day's counts and recipe sheets, one after another. */
export function productionWeekHtml(venueName: string, days: Array<{ label: string; day: ProductionDay }>, state: ProductionState, venueId: string): string {
  const body = days.map((d, i) => dayHtml(venueName, d.label, d.day, state, venueId, i === 0)).join('');
  return documentHtml(`Production · ${venueName} · week`, body);
}

function printHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 1000);
}

export function printProductionSheets(venueName: string, dayLabel: string, day: ProductionDay, state: ProductionState, venueId: string): void {
  printHtml(productionSheetsHtml(venueName, dayLabel, day, state, venueId));
}

export function printProductionWeek(venueName: string, days: Array<{ label: string; day: ProductionDay }>, state: ProductionState, venueId: string): void {
  printHtml(productionWeekHtml(venueName, days, state, venueId));
}
