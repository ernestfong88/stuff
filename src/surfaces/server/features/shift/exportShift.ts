import { COMMUNITY_NAME } from '../../../../data';
import type { ResidentNote } from '../../../../domain/types';
import { formatDayLong, formatMoneyShort, formatTime } from '../../../../lib/format';
import { NOTE_KINDS } from '../shared/noteKinds';
import { escapeHtml, printableDocument } from '../../../../lib/print';
import { tablePeople } from '../shared/tablePeople';
import type { ClosedCheckRow, ShiftTotals } from './closedChecks';

export interface ShiftExport {
  who: string;
  whoName: string;
  at: number;
  meal: string;
  rows: ClosedCheckRow[];
  totals: ShiftTotals;
  checkIns: number;
  openTables: number;
  notes: ResidentNote[];
  residentName: (id: string) => string;
  signedAt?: number;
}

/** A clean, printable copy of the shift review for the shift record. */
export function shiftReviewHtml(x: ShiftExport): string {
  const tile = (v: string | number, l: string) => `<div class="tile"><b>${escapeHtml(v)}</b>${escapeHtml(l)}</div>`;
  const pays = (r: ClosedCheckRow) =>
    [
      r.plan ? `${r.plan} on plan` : '',
      ...r.charges.map((c) => `${c.kind === 'card' ? 'Card' : 'Apt'} ${formatMoneyShort(c.amt)} · ${c.who}`),
      ...r.comps.map((c) => `Comp · ${c.reason} ${formatMoneyShort(c.amt)}`),
    ]
      .filter(Boolean)
      .map(escapeHtml)
      .join('<br>');
  const checks = x.rows.length
    ? `<table><thead><tr><th>Table</th><th>Closed</th><th class="num">Covers</th><th>Who sat there</th><th>Payments</th></tr></thead><tbody>${x.rows
        .map(
          (r) =>
            `<tr><td>${escapeHtml(r.table)}</td><td>${escapeHtml(formatTime(r.closedAt))}</td><td class="num">${r.covers}</td><td>${escapeHtml(
              tablePeople(r.order)
                .map((p) => p.name)
                .join(', '),
            )}</td><td>${pays(r)}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="sub">No closed checks this shift.</p>';
  const notes = x.notes.length
    ? `<table><thead><tr><th>Kind</th><th>Resident</th><th>Note</th><th>Table</th></tr></thead><tbody>${x.notes
        .map(
          (n) =>
            `<tr><td>${escapeHtml(NOTE_KINDS[n.kind].label)}</td><td>${escapeHtml(x.residentName(n.rid))}</td><td>${escapeHtml(n.text)}</td><td>${escapeHtml(n.table ?? '')}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="sub">No notes added this shift.</p>';
  const body =
    `<div class="kick">${escapeHtml(COMMUNITY_NAME)} · Shift review</div>` +
    `<h1>End of shift · ${escapeHtml(x.whoName)}</h1>` +
    `<div class="sub">${escapeHtml(formatDayLong(x.at))} · ${escapeHtml(x.meal)}${x.openTables ? ` · ${x.openTables} table${x.openTables === 1 ? '' : 's'} still open` : ''}</div>` +
    `<div class="tiles">${tile(x.totals.checks, 'checks closed')}${tile(x.totals.covers, 'covers')}${tile(
      formatMoneyShort(x.totals.card.sum),
      `card · ${x.totals.card.count} tx`,
    )}${tile(formatMoneyShort(x.totals.apt.sum), `apartment · ${x.totals.apt.count}`)}${tile(
      x.totals.comps.count,
      `comps${x.totals.comps.count ? ' · ' + formatMoneyShort(x.totals.comps.sum) : ''}`,
    )}${tile(x.checkIns, 'table check-ins')}</div>` +
    `<h2>Checks and payments</h2>${checks}` +
    `<h2>People notes · ${x.notes.length}</h2>${notes}` +
    `<div class="ft">${x.signedAt ? `Signed by ${escapeHtml(x.whoName)} at ${escapeHtml(formatTime(x.signedAt))}.` : 'Not signed off yet.'} Printed ${escapeHtml(
      formatTime(x.at),
    )}.</div>`;
  return printableDocument(`Shift review · ${x.whoName}`, body);
}
