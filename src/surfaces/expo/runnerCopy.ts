/**
 * Expo's runner copy: the course going out, each person's first name and
 * seat, then their plates. It prints from a hidden frame so the screen
 * itself never goes to the printer, and the ticket stays up until bumped.
 */
import { getItem } from '../../data';
import type { DiningConfig } from '../../domain/config';
import { kitchenItemName, modsText } from '../../domain/menu';
import { dinerName } from '../../domain/orders';
import { dinerPills } from '../../domain/residents';
import { serverName } from '../../domain/servers';
import { formatTime } from '../../lib/format';
import { escapeHtml as esc, printHtml } from '../../lib/print';
import { courseWord } from '../kitchen/kitchenTime';
import type { ExpoTicket } from './expoTickets';


const STYLES = `
  @page { margin: 10mm; }
  body { font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; margin: 0; color: #000; }
  header { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 12px; }
  h1 { font-size: 24px; margin: 0; letter-spacing: 0.02em; }
  .sub { font-size: 12px; margin-top: 3px; }
  .person { margin: 0 0 12px; break-inside: avoid; }
  .name { font-size: 19px; font-weight: 800; text-transform: uppercase; display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
  .seat { font-size: 11px; font-weight: 600; text-transform: none; }
  .pill { font-size: 10px; font-weight: 800; text-transform: none; border: 1px solid #000; border-radius: 9px; padding: 0 6px; }
  .pill.allergy { background: #000; color: #fff; }
  .plate { font-size: 15px; font-weight: 700; margin: 4px 0 0 14px; }
  .plate b { font-size: 11px; border: 1.5px solid #000; border-radius: 3px; padding: 0 4px; margin-left: 6px; }
  .more { font-size: 12px; font-weight: 500; margin-left: 14px; }
  .empty { font-size: 14px; }
`;

export interface RunnerCopyInput {
  ticket: ExpoTicket;
  course: number;
  /** "SQ 5", "PU", "DEL" */
  label: string;
  printedAt: number;
  cfg: DiningConfig;
}

export function runnerCopyHtml({ ticket, course, label, printedAt, cfg }: RunnerCopyInput): string {
  const o = ticket.order;
  const name = (itemId: string) => kitchenItemName(getItem(itemId)?.name ?? '', cfg) || 'Item';
  const lines = ticket.allLines.filter((l) => l.course === course && !l.parentId);
  const people: Array<{ diner: ExpoTicket['lines'][number]['diner']; lines: typeof lines }> = [];
  for (const l of lines) {
    const p = people.find((x) => x.diner.id === l.dinerId);
    if (p) p.lines.push(l);
    else people.push({ diner: l.diner, lines: [l] });
  }
  people.sort((a, b) => (a.diner.seat || 99) - (b.diner.seat || 99));

  const body = people
    .map(({ diner, lines: ls }) => {
      const pills = dinerPills(diner)
        .map((p) => `<span class="pill${p.kind === 'allergy' ? ' allergy' : ''}">${esc(p.text)}</span>`)
        .join('');
      const plates = ls
        .map((l) => {
          const sides = diner.items.filter((x) => x.parentId === l.id && !x.comped && !x.cancelled).map((x) => name(x.itemId));
          const notes = [modsText(l.mods, l.note), ...[l.mods?.Notes ?? []].flat()].filter(Boolean).join(' · ');
          return (
            `<div class="plate">${esc(name(l.itemId))}${l.toGo ? '<b>TO GO</b>' : ''}</div>` +
            (sides.length ? `<div class="more">+ ${esc(sides.join(', '))}</div>` : '') +
            (notes ? `<div class="more">${esc(notes)}</div>` : '')
          );
        })
        .join('');
      return `<section class="person"><div class="name">${esc(dinerName(diner).split(' ')[0])}<span class="seat">seat ${esc(diner.seat)}</span>${pills}</div>${plates}</section>`;
    })
    .join('');

  const heading = o.queueType ? 'All together' : `Course ${course} · ${courseWord(course)}`;
  const sub = [heading, o.server ? serverName(o.server) : '', 'printed ' + formatTime(printedAt)].filter(Boolean).join(' · ');
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(label + ' · ' + heading)}</title><style>${STYLES}</style></head>` +
    `<body><header><h1>${esc(label)}</h1><div class="sub">${esc(sub)}</div></header>` +
    (body || '<p class="empty">Nothing on this course.</p>') +
    '</body></html>'
  );
}

/** Print a document from a hidden frame. */
export const printDocument = printHtml;
