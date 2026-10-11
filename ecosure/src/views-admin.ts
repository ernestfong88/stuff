/** Import and Settings pages. */
import type { QItem } from './importer';
import type { Model } from './model';
import type { Rec } from './types';
import { esc, fmtDate, plural } from './util';
import type { ViewState } from './views';

const head = (crumb: string, title: string, lede: string) => `<p class="crumb">${esc(crumb)}</p><h2 class="page">${esc(title)}</h2><p class="lede">${lede}</p>`;

function readOnly(v: ViewState): string {
  return v.canWrite ? '' : '<div class="warnbox">You can view this page but not change its data. Ask the page owner for Contributor access to import files.</div>';
}

function summary(q: QItem, m: Model, stored: Map<string, Rec>, thumbs: Map<string, string>): string {
  if (q.kind === 'legacy' || q.kind === 'backup') {
    const r = q.recs.filter((x) => x.kind === 'report').length, c = q.recs.filter((x) => x.kind === 'cap').length;
    return `<div class="sum"><span>${plural(r, 'report')}</span><span>${plural(c, 'CAP')}</span><span>${plural(Object.keys(q.dataPhotos).length, 'photo')}</span>${q.settings ? '<span>Includes settings and roster</span>' : ''}</div>`;
  }
  return q.recs.map((r) => {
    const onRoster = m.settings.roster.some((c) => c.name === r.community);
    const exists = stored.has(r.id);
    const photos = r.items.flatMap((i) => i.photos);
    const lines = r.kind === 'report'
      ? [`<b>${esc(r.community)}</b>`, esc(r.kitchen), r.date ? fmtDate(r.date) : 'No date', `Score ${r.score ?? 'unread'}`, plural(r.items.length, 'finding'), `${r.items.filter((i) => i.criticality === 'Critical').length} critical`, plural(photos.length, 'photo')]
      : [`<b>${esc(r.community)}</b>`, esc(r.kitchen), r.auditDate ? `Audit of ${fmtDate(r.auditDate)}` : 'Audit date unknown', `Status ${esc(r.status)}`, r.submitted ? `Submitted ${fmtDate(r.submitted)}` : 'Not submitted', plural(r.items.length, 'item'), plural(photos.length, 'photo')];
    const warn = [...r.warnings];
    if (!onRoster) warn.push(`"${r.community}" is not on the community roster. Saving adds it; rename it in Settings if it is a spelling of an existing community.`);
    return `<div class="sum">${lines.map((l) => `<span>${l}</span>`).join('')}</div>
      ${exists ? '<div class="note">This replaces a record already on file for the same kitchen and date.</div>' : ''}
      ${warn.length ? `<div class="warnbox"><b>Check before saving</b><ul>${warn.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : (r.kind === 'report' && r.score != null ? '<div class="okbox">Points lost match the score.</div>' : '')}
      ${photos.length ? `<div class="thumbs">${photos.slice(0, 8).map((p) => `<img src="${esc(thumbs.get(p) ?? '')}" alt="Photo from ${esc(q.name)}">`).join('')}${photos.length > 8 ? `<span class="note">+${photos.length - 8} more</span>` : ''}</div>` : ''}`;
  }).join('');
}

export function importView(m: Model, v: ViewState, queue: QItem[], storedList: Rec[], thumbs: Map<string, string>, onFile: Rec[]): string {
  const stored = new Map(onFile.map((r) => [r.id, r]));
  const ready = queue.filter((q) => q.status === 'ready').length;
  const reports = storedList.filter((r) => r.kind === 'report' && !r.deleted).length;
  const caps = storedList.filter((r) => r.kind === 'cap' && !r.deleted).length;
  const where = v.mode === 'shared' ? 'Saved files go to this page\'s shared storage, so everyone with access sees them right away.' : 'This copy is not running as the published page, so imports are saved in this browser only. Use Download backup to move them.';
  return head('Import', 'Add EcoSure files',
    `Drop EcoSure report PDFs and CAP PDFs here. The site reads each file in your browser, shows what it found, and saves it when you confirm. ${where}`) +
    readOnly(v) +
    (v.canWrite ? `<label class="drop" id="drop" for="file"><b>Drop PDFs here</b><span class="note">Food safety reports and Corrective Action Plans from EcoSure. You can drop many at once.</span><span class="btn">Choose files</span><input id="file" type="file" accept=".pdf,.json,.html,application/pdf" multiple hidden></label>` : '') +
    (queue.length ? `<div class="toolbar" style="margin-top:18px"><h3 style="margin:0">Files to review</h3><span class="grow"></span>${ready ? `<button class="btn" data-act="save-all">Save ${ready === 1 ? 'file' : 'all ' + ready + ' files'}</button>` : ''}<button class="btn quiet sm" data-act="clear-queue">Clear list</button></div>
      <div class="queue">${queue.map((q) => `<div class="qi"><div class="top"><span class="fname">${esc(q.name)}</span>
        <span class="chip ${q.status === 'error' ? 't-bad' : q.status === 'saved' ? 't-good' : q.status === 'ready' ? 't-info' : 't-none'}">${{ reading: 'Reading', ready: q.kind === 'cap' ? 'CAP' : q.kind === 'report' ? 'Report' : q.kind === 'legacy' ? 'Previous review page' : 'Backup', saving: 'Saving', saved: 'Saved', error: 'Not imported', skipped: 'Skipped' }[q.status]}</span>
        ${q.status === 'reading' || q.status === 'saving' ? `<span class="spin" aria-hidden="true"></span><span class="note">${esc(q.progress ?? '')}</span>` : ''}
        <span class="grow"></span>
        ${q.status === 'ready' ? `<span class="acts"><button class="btn sm" data-act="save:${q.id}">Save</button><button class="btn quiet sm" data-act="skip:${q.id}">Skip</button></span>` : ''}
        ${q.status === 'saved' && q.recs[0] ? `<button class="btn ghost sm" data-go="c-${esc(m.communities.find((c) => c.c.name === q.recs[0].community)?.slug ?? '')}">Open community</button>` : ''}</div>
        ${q.error ? `<div class="warnbox">${esc(q.error)}</div>` : ''}
        ${q.status === 'ready' || q.status === 'saved' ? summary(q, m, stored, thumbs) : ''}</div>`).join('')}</div>` : '') +
    `<section class="block grid two">
      <div class="panel"><h3>What happens to each file</h3><ul class="plain">
        <li><b>Report PDF:</b> adds the kitchen's audit with score, findings and photos. The site checks that points lost add up to the score and flags anything it could not read.</li>
        <li><b>CAP PDF:</b> attaches the action plan to the audit with the same kitchen and audit date. If the report has not arrived, the CAP's findings show as the audit until it does.</li>
        <li><b>Same kitchen and date again:</b> replaces the earlier copy, so re-importing an updated CAP is safe.</li>
        <li><b>Backup .json or the old review page .html:</b> restores records exported from this site or the previous version.</li>
      </ul></div>
      <div class="panel"><h3>Data on file</h3><p>${plural(reports, 'imported report')} and ${plural(caps, 'imported CAP')}, on top of the ${plural(m.audits.filter((a) => a.report?.source === 'legacy').length, 'audit')} carried over from the previous review page.</p>
        <div class="toolbar"><button class="btn ghost sm" data-act="backup">Download backup</button><button class="btn ghost sm" data-act="csv-findings-all">Download all findings (CSV)</button></div>
        ${storedList.filter((r) => !r.deleted).length ? `<details><summary>Imported records</summary><div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>Record</th><th>File</th><th>Imported</th><th></th></tr></thead><tbody>
        ${storedList.filter((r) => !r.deleted).sort((a, b) => b.importedAt.localeCompare(a.importedAt)).map((r) => `<tr><td>${r.kind === 'report' ? 'Report' : 'CAP'}: ${esc(r.community)}, ${esc(r.kitchen)}, ${fmtDate(r.kind === 'report' ? r.date : r.auditDate || r.submitted)}</td><td>${esc(r.file)}</td><td>${fmtDate(r.importedAt.slice(0, 10))}</td><td>${v.canWrite ? `<button class="btn danger sm" data-act="del:${esc(r.id)}">Remove</button>` : ''}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
      </div></section>`;
}

export function settingsView(m: Model, v: ViewState): string {
  const s = m.settings;
  const dis = v.canWrite ? '' : ' disabled';
  return head('Settings', 'Roster and rules', 'The community roster drives the "needs an audit" list, and the rounds decide which audits count as this round. Changes are shared with everyone who uses the page.') +
    readOnly(v) +
    `<form id="settings">
    <section class="panel"><h3>Rules</h3><div class="form">
      <label class="field"><span class="lbl">CAP expected within (days of the audit)</span><input type="number" id="s-capDueDays" min="1" max="90" value="${s.capDueDays}"${dis}></label>
      <label class="field"><span class="lbl">Audit overdue after (days since the last one)</span><input type="number" id="s-cycleDays" min="30" max="400" value="${s.cycleDays}"${dis}></label>
    </div><p class="note" style="margin-top:8px">Score bands: 85 and up is good, 70 to 84 is a warning, below 70 is a community of focus. Critical findings cost 5 points, Major 3, Minor 1.</p></section>
    <section class="block panel"><h3>Audit rounds</h3><div class="tablewrap"><table><thead><tr><th>Name</th><th>Starts</th><th>Ends</th><th></th></tr></thead><tbody>
      ${s.rounds.map((r, i) => `<tr><td><input type="text" id="r-name-${i}" value="${esc(r.name)}"${dis}></td><td><input type="date" id="r-start-${i}" value="${r.start}"${dis}></td><td><input type="date" id="r-end-${i}" value="${r.end}"${dis}></td><td>${v.canWrite ? `<button type="button" class="btn danger sm" data-act="round-del:${i}">Remove</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>${v.canWrite ? '<div class="toolbar" style="margin-top:10px"><button type="button" class="btn ghost sm" data-act="round-add">Add round</button></div>' : ''}</section>
    <section class="block panel"><h3>Community roster <span class="sm">${s.roster.filter((c) => c.active).length} active</span></h3>
      ${m.unknown.length ? `<div class="warnbox">These names appear in imported files but not on the roster: ${m.unknown.map(esc).join(', ')}. Add them, or add the name as an "Also known as" spelling on the right community.${v.canWrite ? ' <button type="button" class="btn sm" data-act="roster-add-unknown">Add to roster</button>' : ''}</div>` : ''}
      <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Community (as EcoSure prints it)</th><th>Short name</th><th>City</th><th>Kitchens</th><th>Also known as</th><th>Note (shows on the action list)</th><th class="c">Active</th></tr></thead><tbody>
      ${s.roster.map((c, i) => `<tr><td><input type="text" id="c-name-${i}" value="${esc(c.name)}"${dis}></td><td><input type="text" id="c-short-${i}" value="${esc(c.short)}" size="12"${dis}></td><td><input type="text" id="c-city-${i}" value="${esc(c.city)}" size="12"${dis}></td><td><input type="number" id="c-k-${i}" min="1" max="9" value="${Math.max(1, c.kitchens.length)}" style="width:64px"${dis}></td><td><input type="text" id="c-alias-${i}" value="${esc(c.aliases.join('; '))}" placeholder="Other spellings; separated by ;"${dis}></td><td><input type="text" id="c-note-${i}" value="${esc(c.note)}" placeholder="Report pending, scheduled..."${dis}></td><td class="c"><input type="checkbox" id="c-active-${i}"${c.active ? ' checked' : ''}${dis}></td></tr>`).join('')}
      </tbody></table></div>${v.canWrite ? '<div class="toolbar" style="margin-top:10px"><button type="button" class="btn ghost sm" data-act="roster-add">Add community</button></div>' : ''}</section>
    ${v.canWrite ? '<div class="toolbar" style="margin-top:18px"><button class="btn" type="submit">Save settings</button><span class="note">Last saved ' + (s.updatedAt ? fmtDate(s.updatedAt.slice(0, 10)) : 'never (using defaults)') + '</span></div>' : ''}
    </form>`;
}
