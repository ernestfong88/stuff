/** Page renderers. Each returns HTML for <main>; main.ts wires the events. */
import { THEMES, SECTIONS, themeOf } from './catalog';
import { CRIT_COLOR, bars, critLegend, scoreLine } from './charts';
import {
  CAP_LABEL, CAP_TONE, scoreBand,
  type Audit, type CommunityView, type Finding, type Model, capMissing, capMissingText,
} from './model';
import { fileUrl, photoUrl } from './store';
import { themeHeat } from './views-roles';
import { fold, top } from './expand';
import { communitySnap, photoStrip } from './views-brief';
import { bigBox, critMix, isActivity, pestLabel, pestStatus, shortOf, statusChip } from './views-common';
import { PLAYBOOK } from './playbook';
import { plainTitle } from './plain';
import type { Crit } from './types';
import { avg, countBy, esc, fmtDate, pct, plural, todayIso } from './util';

export interface Filters {
  community: string;
  kitchen: string;
  section: string;
  theme: string;
  crit: string;
  cap: string; // all | has | none | open | closed (remediated)
  comms: string[] | null; // the dashboard's community selection, carried over when a reader drills in
  commsLabel: string;
  std: string;
  q: string;
  repeat: boolean;
  photos: boolean;
  limit: number;
}
export const emptyFilters = (): Filters => ({ community: 'all', kitchen: 'all', section: 'all', theme: 'all', crit: 'all', cap: 'all', comms: null, commsLabel: '', std: '', q: '', repeat: false, photos: false, limit: 5 });

export interface ViewState {
  round: string; // 'all' or a round name
  f: Filters;
  canWrite: boolean;
  mode: 'shared' | 'local' | 'starting';
  capEdit: string | null; // audit key with the CAP form open
}

/* ---------- small pieces ---------- */
export const scorePill = (s: number | null) => `<span class="score s-${scoreBand(s)}">${pct(s)}</span>`;
const chip = (tone: string, text: string, title = '') => `<span class="chip t-${tone}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;
export const capChip = (a: Audit, today = todayIso()) => capMissing(a) ? `<span class="chip t-bad capmiss">${esc(capMissingText(a, today))}</span>` : chip(CAP_TONE[a.capState], CAP_LABEL[a.capState], a.cap ? `EcoSure status: ${a.cap.status}` : '');
const critChip = (c: Crit) => `<span class="chip c-${c}">${c}</span>`;
function delta(cur: number | null, prev: number | null): string {
  if (cur == null || prev == null) return '<span class="delta flat">no prior</span>';
  const d = Math.round(cur - prev);
  return `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '+' : ''}${d}</span>`;
}
const head = (crumb: string, title: string, lede: string) => `<p class="crumb">${esc(crumb)}</p><h2 class="page">${esc(title)}</h2><p class="lede">${lede}</p>`;
const kitchenLabel = (a: Audit, m: Model) => { const n = shortOf(m, a.community); return (m.bySlug.get(a.slug)?.c.kitchens.length ?? 1) > 1 || a.kitchen !== 'Main Kitchen' ? `${n}, ${a.kitchen}` : n; };
const shortName = shortOf;

export function roundChips(m: Model, v: ViewState): string {
  const used = new Set(m.audits.map((a) => a.round));
  const rounds = [...m.settings.rounds.map((r) => r.name).filter((n) => used.has(n)), ...[...used].filter((n) => !m.settings.rounds.some((r) => r.name === n)).sort()];
  if (rounds.length < 2 && v.round === 'all') return `<div class="toolbar"><span class="lbl">Round</span><button class="fbtn" aria-pressed="true">${esc(rounds[0] ?? 'All')}</button></div>`;
  return `<div class="toolbar"><span class="lbl">Round</span>${['all', ...rounds].map((r) => `<button class="fbtn" data-round="${esc(r)}" aria-pressed="${v.round === r}">${r === 'all' ? 'All rounds' : esc(r)}</button>`).join('')}</div>`;
}

export function inRound(m: Model, v: ViewState): Audit[] {
  return v.round === 'all' ? m.audits : m.audits.filter((a) => a.round === v.round);
}

/** Latest audit per kitchen within the selected round. */
export function latestPerKitchen(audits: Audit[]): Audit[] {
  const m = new Map<string, Audit>();
  for (const a of audits) { const k = a.community + '|' + a.kitchen; const p = m.get(k); if (!p || a.date > p.date) m.set(k, a); }
  return [...m.values()];
}

/* ---------- overview ---------- */
export function auditWhy(c: CommunityView, m: Model): string {
  if (c.c.note) return c.c.note;
  if (!c.lastDate) return 'No EcoSure audit on file.';
  const last = `Last audited ${fmtDate(c.lastDate)} (${c.daysSince} days ago)`;
  if (c.auditState === 'overdue') return `${last}. Past the ${m.settings.cycleDays} day cycle since ${fmtDate(c.nextDue)}.`;
  if (c.auditState === 'due') return `${last}. Not yet audited in ${m.currentRound?.name ?? 'this round'}${c.score != null && c.score < 70 ? '; scored below 70 last time' : ''}.`;
  return last + '.';
}

/* ---------- community page ---------- */
export function community(m: Model, v: ViewState, slugKey: string, auditKey: string | null): string {
  const c = m.bySlug.get(slugKey);
  if (!c) return head('Community', 'Not found', 'This community is not in the data. <button class="linkbtn" data-go="dashboard">Back to the dashboard</button>');
  const dates = [...new Set(c.audits.map((a) => a.date))].sort().reverse();
  const selDate = auditKey && dates.includes(auditKey) ? auditKey : dates[0];
  const A = c.audits.filter((a) => a.date === selDate).sort((x, y) => x.kitchen.localeCompare(y.kitchen));
  const multiK = new Set(c.audits.map((a) => a.kitchen)).size > 1;
  const items = A.flatMap((a) => a.items);
  const fil = v.f;
  const shown = items.filter((i) => (fil.crit === 'all' || i.criticality === fil.crit) && (fil.kitchen === 'all' || i.audit.kitchen === fil.kitchen));
  const sn = communitySnap(A);
  const scored = A.filter((a) => a.score != null);
  const score = avg(scored.map((a) => a.score));

  const pageHead = `<div class="pagehead"><div><p class="crumb"><button class="linkbtn" data-go="dashboard">Executive dashboard</button> / ${esc([c.c.city, c.c.region].filter(Boolean).join(' · '))}</p><h2 class="page">${esc(c.c.short || c.c.name)}${c.c.short && c.c.short !== c.c.name ? ` <span class="fullname">${esc(c.c.name)}</span>` : ''}</h2></div><div class="pageacts"><button class="btn ghost sm" data-act="share">Copy link</button><button class="btn sm" data-act="copy-community:${c.slug}">Copy as email</button></div></div>`;
  if (!A.length) return pageHead + `<div class="empty">${esc(auditWhy(c, m))}</div>`;

  // The same snapshot as the dashboard, for this community's audit.
  const pestAct = sn.pests.filter(isActivity);
  const hero = `<section class="dhero" aria-label="Audit snapshot">
    <p class="dhl">EcoSure found <b>${sn.found} issues</b> on ${fmtDate(selDate)}. <b class="good">${sn.rate}%</b> are resolved.</p>
    <div class="dbig">
      ${bigBox('Score', score == null ? 'Pending' : pct(score), { tone: score == null ? '' : scoreBand(score), sub: multiK || A.length > 1 ? esc(A.map((a) => `${a.kitchen} ${a.score == null ? 'pending' : pct(a.score)}`).join(' · ')) : '' })}
      ${bigBox('Issues found', String(sn.found), { sub: plural(sn.top.length ? new Set(items.map((f) => f.short)).size : 0, 'issue') })}
      ${bigBox('Resolved', sn.rate + '%', { tone: 'good', meter: sn.rate, sub: `${sn.done} of ${sn.found}` })}
    </div>
    ${items.length ? critMix(items, '') : ''}
    ${sn.top.length ? `<div class="dtop3"><span class="dl">Top 3 challenges and what the team did</span><ol>${sn.top.map((t) => `<li><b>${esc(t.title)}</b><span class="xs">${t.crit}${multiK ? ` · ${esc(t.kitchens.join(', '))}` : ''}</span>${statusChip(t.fs)}<span class="did">${t.action ? esc(t.action.length > 160 ? t.action.slice(0, 157) + '...' : t.action) : 'No corrective action written yet.'}</span>${PLAYBOOK[t.short] ? `<span class="xs have">What to have in place: ${esc(PLAYBOOK[t.short].have[0])}</span>` : ''}</li>`).join('')}</ol></div>` : ''}
  </section>`;

  const alerts = (pestAct.length ? `<div class="capbanner pestbanner" role="status"><b>Pest activity</b><span>${pestAct.map((f) => `${multiK ? esc(f.audit.kitchen) + ': ' : ''}${esc(f.comment || pestLabel(f))}`).join(' · ')} ${(() => { const [st, tone] = pestStatus(pestAct); return `<span class="chip t-${tone} plain">${st}</span>`; })()}</span></div>` : '') +
    (A.some(capMissing) ? `<div class="capbanner" role="status"><b>CAP missing</b><span>${A.filter(capMissing).map((a) => `${esc(a.kitchen)}: ${esc(capMissingText(a, m.today).replace('CAP missing · ', ''))}`).join(' · ')}. Ask the team to submit the corrective action plan in EcoSure.</span></div>` : '');

  const history = c.audits.filter((a) => a.score != null);
  const kitchens = [...new Set(history.map((a) => a.kitchen))];
  const histBody = kitchens.some((k) => history.filter((a) => a.kitchen === k).length > 1) ? `<div class="grid two">${kitchens.map((k) => `<div class="panel"><b>${esc(k)}</b>${scoreLine(history.filter((a) => a.kitchen === k).map((a) => ({ x: fmtDate(a.date, true), y: a.score, label: `${k}, ${fmtDate(a.date)}` })))}</div>`).join('')}</div>` : '';
  const lookBody = items.length ? `<div class="grid themes">${THEMES.map((t) => {
    const it = items.filter((i) => themeOf(i.short) === t.t);
    if (!it.length) return '';
    const cls = it.some((i) => i.criticality === 'Critical') ? 'p0' : it.some((i) => i.criticality === 'Major') ? 'p1' : '';
    return `<div class="theme ${cls}"><b>${esc(t.t)}</b><p>${esc(t.look)}</p><ul>${[...countBy(it, (i) => i.short)].map(([s, n]) => `<li><span>${esc(plainTitle(s))}</span><span>${n > 1 ? n + 'x' : ''}</span></li>`).join('')}</ul></div>`;
  }).join('')}</div>` : '';
  const findingsBody = items.length ? `<div class="toolbar"><span class="lbl">Show</span>${['all', 'Critical', 'Major', 'Minor'].map((k) => `<button class="fbtn" data-crit="${k}" aria-pressed="${fil.crit === k}">${k === 'all' ? 'All' : k}<span class="n">${k === 'all' ? items.length : items.filter((i) => i.criticality === k).length}</span></button>`).join('')}
      ${multiK ? `<span class="lbl" style="margin-left:8px">Kitchen</span>${['all', ...A.map((a) => a.kitchen)].map((k) => `<button class="fbtn" data-kitchen="${esc(k)}" aria-pressed="${fil.kitchen === k}">${k === 'all' ? 'All' : esc(k)}</button>`).join('')}` : ''}</div>
      <div class="finds">${shown.map((i) => findingCard(i, m, multiK, false)).join('') || '<div class="empty">No findings match.</div>'}</div>` : '';
  const capForms = v.canWrite ? A.filter((a) => a.items.length || a.cap).map((a) => capForm(a, v)).join('') : '';
  const unmatched = A.filter((a) => a.capUnmatched.length);
  const sources = A.flatMap((a) => [a.report && { what: `${a.kitchen} report`, file: a.report.file, ref: a.report.fileRef, src: a.report.source }, a.cap && { what: `${a.kitchen} CAP (${a.cap.status})`, file: a.cap.file, ref: a.cap.fileRef, src: a.cap.source }]).filter(Boolean) as { what: string; file: string; ref?: string; src: string }[];
  const photos = photoStrip(c.slug + '-' + selDate, A);

  return pageHead +
    (dates.length > 1 ? `<div class="toolbar"><span class="lbl">Audit</span>${dates.map((d) => `<button class="fbtn" data-audit="${d}" aria-pressed="${d === selDate}">${fmtDate(d)}</button>`).join('')}</div>` : '') +
    alerts + hero +
    (photos ? `<section class="block"><h3>Photos</h3>${photos}</section>` : '') +
    `<section class="block folds">` +
    fold('findings', `All findings and photos <span class="sm">${plural(items.length, 'finding')}</span>`, findingsBody) +
    fold('look', 'What to look for on a visit', lookBody) +
    fold('history', 'Score history', histBody) +
    fold('well', 'What went well', A.some((a) => a.positive.length) ? `<ul class="plain">${[...new Set(A.flatMap((a) => a.positive))].map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '') +
    fold('details', 'Manager and health inspection', `<div class="meta">${A[0]?.manager ? `<span>Manager: ${esc(A[0].manager)}</span>` : ''}${A[0]?.hdResult ? `<span>Last health inspection: ${esc(A[0].hdResult)}${A[0].hdDate ? ' on ' + esc(fmtDate(A[0].hdDate) || A[0].hdDate) : ''}</span>` : ''}<span>${plural(c.audits.length, 'kitchen audit')} on file</span></div>`) +
    fold('capform', 'Update CAP status', capForms ? `<p class="note">Use this when a CAP update arrives by email or in EcoSure before you have the PDF. Importing the CAP PDF later replaces it.</p><div class="grid">${capForms}</div>` : '', !!v.capEdit) +
    fold('sources', 'Source files', sources.length ? `<ul class="plain">${sources.map((s) => `<li>${esc(s.what)}: ${s.ref ? `<a href="${esc(fileUrl(s.ref))}" target="_blank" rel="noopener">${esc(s.file)}</a>` : esc(s.file)}${s.src === 'legacy' ? ' <span class="note">(from the previous review page)</span>' : ''}</li>`).join('')}</ul>` : '') +
    (unmatched.length ? `<div class="warnbox"><b>CAP lines that did not match a finding</b><ul>${unmatched.flatMap((a) => a.capUnmatched.map((x) => `<li>${esc(a.kitchen)}: ${esc(x.cid)} ${esc(x.question)}</li>`)).join('')}</ul></div>` : '') +
    `</section>`;
}

function capForm(a: Audit, v: ViewState): string {
  const open = v.capEdit === a.key;
  if (!open) return `<div class="panel"><div class="toolbar" style="margin:0"><b>${esc(a.kitchen)}</b>${a.items.length ? capChip(a) : ''}<span class="note">EcoSure status: ${esc(a.cap?.status ?? 'none on file')}</span><span class="grow"></span><button class="btn ghost sm" data-act="cap-edit:${esc(a.key)}">Update</button></div></div>`;
  const st = a.cap?.status ?? 'Pending';
  return `<form class="panel" data-capform="${esc(a.key)}"><b>${esc(a.kitchen)}, audit of ${fmtDate(a.date)}</b>
    <div class="form" style="margin-top:10px">
      <label class="field"><span class="lbl">EcoSure status</span><select name="status" id="cap-status-${esc(a.key)}">${['Initiated', 'Pending', 'Submitted', 'Approved', 'Completed', 'Rejected'].map((s) => `<option${s === st ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="field"><span class="lbl">Submitted</span><input type="date" name="submitted" id="cap-sub-${esc(a.key)}" value="${esc(a.cap?.submitted ?? '')}"></label>
      <label class="field"><span class="lbl">Approved</span><input type="date" name="approved" id="cap-app-${esc(a.key)}" value="${esc(a.cap?.approved ?? '')}"></label>
      <label class="field"><span class="lbl">Owner</span><input type="text" name="owner" id="cap-own-${esc(a.key)}" value="${esc(a.cap?.items[0]?.owner ?? a.manager)}"></label>
    </div>
    <label class="field" style="margin-top:10px"><span class="lbl">Note (applies to every finding without its own action)</span><textarea name="note" id="cap-note-${esc(a.key)}" placeholder="For example: All items corrected; ice machine deep cleaned on Oct 2."></textarea></label>
    <div class="toolbar" style="margin:10px 0 0"><button class="btn" type="submit">Save CAP status</button><button class="btn quiet" type="button" data-act="cap-edit:">Cancel</button></div></form>`;
}

export function findingCard(i: Finding, m: Model, showKitchen: boolean, showCommunity: boolean): string {
  const a = i.audit;
  const where = showCommunity ? `<button class="linkbtn" data-go="c-${a.slug}">${esc(kitchenLabel(a, m))}</button> · ${fmtDate(a.date)}` : showKitchen ? esc(a.kitchen) : '';
  const ci = i.capItem;
  const cap = ci ? `<div class="capbox"><div class="ct"><b style="color:${a.capState === 'closed' ? 'var(--good)' : 'var(--maj)'}">CAP ${esc(a.cap?.status ?? '')}</b>${ci.owner ? `<span>Owner: ${esc(ci.owner)}</span>` : ''}${ci.due ? `<span>Due ${fmtDate(ci.due)}</span>` : ''}</div>${ci.action ? `<p>${esc(ci.action)}</p>` : ''}${ci.update ? `<p class="note">Update: ${esc(ci.update)}</p>` : ''}${!ci.action && !ci.update ? '<p class="note">No action written.</p>' : ''}</div>`
    : a.items.length ? `<div class="capbox none">${a.cap ? 'This finding is not on the CAP.' : 'No CAP on file yet.'}</div>` : '';
  return `<article class="find"><div class="top"><span class="std">${esc(plainTitle(i.short))}</span>${critChip(i.criticality)}${i.repeat ? '<span class="repeat" title="Also cited at this kitchen\'s previous audit">REPEAT</span>' : ''}${where ? `<span class="where">${where}</span>` : ''}<span class="pts">${i.cid ? esc(i.cid) + ' · ' : ''}${i.points ? '-' + i.points + ' pts' : 'unrated'}</span></div>
    <p class="q">${esc(i.section)}${i.subsection ? ' / ' + esc(i.subsection) : ''}: ${esc(i.question)}</p>
    ${i.comment ? `<p class="cm">${esc(i.comment)}</p>` : ''}
    ${i.findings.length ? `<ul class="fl">${i.findings.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
    ${i.photos.length ? `<div class="thumbs">${i.photos.map((p, n) => `<button data-photo="${esc(i.key)}" data-n="${n}" aria-label="Open photo ${n + 1} of ${esc(i.short)}"><img loading="lazy" src="${esc(photoUrl(p))}" alt="${esc(i.short)}"></button>`).join('')}</div>` : ''}
    ${cap}</article>`;
}

/* ---------- findings explorer ---------- */
export function filterFindings(m: Model, v: ViewState): Finding[] {
  const f = v.f, q = f.q.trim().toLowerCase();
  return inRound(m, v).flatMap((a) => a.items).filter((i) =>
    (f.community === 'all' || f.community.startsWith('band:') || i.audit.community === f.community) &&
    (!f.comms || f.comms.includes(i.audit.community)) &&
    (f.section === 'all' || i.section === f.section) &&
    (f.theme === 'all' || themeOf(i.short) === f.theme) &&
    (f.crit === 'all' || i.criticality === f.crit) &&
    (!f.std || i.short === f.std) &&
    (f.cap === 'all' || (f.cap === 'has' && !!i.capItem) || (f.cap === 'none' && !i.capItem) || (f.cap === 'open' && i.audit.capState !== 'closed') || (f.cap === 'closed' && !!i.capItem && i.audit.capState === 'closed')) &&
    (!f.repeat || i.repeat) && (!f.photos || i.photos.length > 0) &&
    (!q || [i.short, i.question, i.comment, ...i.findings, i.capItem?.action ?? '', i.audit.community].join(' ').toLowerCase().includes(q)));
}

export function findings(m: Model, v: ViewState): string {
  const f = v.f;
  const list = filterFindings(m, v).sort((a, b) => ['Critical', 'Major', 'Minor', 'Unrated'].indexOf(a.criticality) - ['Critical', 'Major', 'Minor', 'Unrated'].indexOf(b.criticality) || Number(b.photos.length > 0) - Number(a.photos.length > 0) || b.audit.date.localeCompare(a.audit.date));
  const comms = [...new Set(m.audits.map((a) => a.community))].sort();
  const sel = (id: string, label: string, val: string, opts: [string, string][]) => `<label class="field"><span class="lbl">${label}</span><select id="${id}" data-filter="${id.replace('f-', '')}">${opts.map(([k, t]) => `<option value="${esc(k)}"${k === val ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const byStd = [...countBy(list, (i) => i.short)].sort((a, b) => b[1] - a[1]);
  const critOf = (s: string) => list.find((i) => i.short === s)?.criticality ?? 'Minor';
  const active = !!f.comms || f.community !== 'all' || f.section !== 'all' || f.theme !== 'all' || f.crit !== 'all' || f.cap !== 'all' || f.std || f.q || f.repeat || f.photos;
  const moreActive = f.section !== 'all' || f.theme !== 'all' || f.cap !== 'all' || f.repeat || f.photos;
  return head('Findings', 'Findings and photos', 'Pick a community or an issue to narrow the list. The most common issues for your selection are at the top.') +
    `<div class="panel"><div class="form">
      ${sel('f-community', 'Community', f.community.startsWith('band:') ? 'all' : f.community, [['all', 'All communities'], ...comms.map((c): [string, string] => [c, shortOf(m, c)]).sort((a, b) => a[1].localeCompare(b[1]))])}
      ${sel('f-crit', 'Criticality', f.crit, [['all', 'All'], ['Critical', 'Critical'], ['Major', 'Major'], ['Minor', 'Minor'], ['Unrated', 'Unrated']])}
      <label class="field"><span class="lbl">Search</span><input type="search" id="f-q" data-filter="q" value="${esc(f.q)}" placeholder="ice machine, gaskets, sanitizer"></label>
    </div>
    ${fold('more-filters', 'More filters', `<div class="form">
      ${sel('f-section', 'Section', f.section, [['all', 'All sections'], ...[...new Set([...SECTIONS, ...m.findings.map((i) => i.section)])].map((s): [string, string] => [s, s])])}
      ${sel('f-theme', 'Theme', f.theme, [['all', 'All themes'], ...THEMES.map((t): [string, string] => [t.t, t.t])])}
      ${sel('f-cap', 'CAP', f.cap, [['all', 'Any'], ['closed', 'Remediated'], ['open', 'Not yet remediated'], ['has', 'Has a CAP action'], ['none', 'No CAP action']])}
    </div><div class="toolbar" style="margin:12px 0 0"><button class="fbtn" data-toggle="repeat" aria-pressed="${f.repeat}">Repeat findings only</button><button class="fbtn" data-toggle="photos" aria-pressed="${f.photos}">With photos</button></div>${roundChips(m, v)}`, moreActive)}
    <div class="toolbar" style="margin:10px 0 0">${f.comms ? `<button class="fbtn" aria-pressed="true" data-act="clear-comms" title="Communities picked on the dashboard">${esc(f.commsLabel || plural(f.comms.length, 'community', 'communities'))} ✕</button>` : ''}${f.std ? `<button class="fbtn" aria-pressed="true" data-act="clear-std">${esc(plainTitle(f.std))} ✕</button>` : ''}
      <span class="grow"></span>${active ? '<button class="btn quiet sm" data-act="clear-filters">Clear filters</button>' : ''}<button class="btn ghost sm" data-act="csv-findings">Download CSV</button></div></div>
    <section class="block"><h3>${f.std ? esc(plainTitle(f.std)) : 'Top 5 issues'} <span class="sm">${plural(list.length, 'finding')} in ${plural(new Set(list.map((i) => i.audit.community)).size, 'community', 'communities')}</span></h3>
      ${f.std ? '' : bars(byStd.slice(0, 5).map(([s, n]) => ({ label: plainTitle(s), value: n, act: 'std:' + s, segs: [{ v: n, color: CRIT_COLOR[critOf(s)], title: critOf(s) }] })))}</section>
    <section class="block"><div class="finds">${list.slice(0, f.limit).map((i) => findingCard(i, m, true, true)).join('') || '<div class="empty">No findings match these filters.</div>'}</div>
    ${list.length > f.limit ? `<p class="more"><button class="btn quiet sm" data-act="more">Show ${Math.min(10, list.length - f.limit)} more of ${list.length - f.limit}</button></p>` : ''}</section>`;
}

/* ---------- trends ---------- */
export function trends(m: Model, v: ViewState): string {
  const rounds = [...new Set(m.audits.map((a) => a.round))].sort((a, b) => {
    const ra = m.settings.rounds.findIndex((r) => r.name === a), rb = m.settings.rounds.findIndex((r) => r.name === b);
    return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) || a.localeCompare(b);
  });
  const roundRows = rounds.map((r) => {
    const A = m.audits.filter((a) => a.round === r);
    const s = avg(A.map((a) => a.score));
    return { r, s, n: A.length, f: A.reduce((x, a) => x + a.items.length, 0) / Math.max(1, A.length), crit: A.reduce((x, a) => x + a.crit, 0) };
  });
  const A = inRound(m, v);
  const items = A.flatMap((a) => a.items);
  const comms = [...new Set(A.map((a) => a.community))].sort();
  const stds = [...countBy(items, (i) => i.short)].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([s]) => s);
  const cell = (c: string, s: string) => {
    const it = items.filter((i) => i.audit.community === c && i.short === s);
    if (!it.length) return '<td style="background:var(--hm0)"></td>';
    const w = it.reduce((x, i) => x + i.points, 0);
    const bg = w >= 5 ? 'var(--hm3)' : w >= 3 ? 'var(--hm2)' : 'var(--hm1)';
    return `<td style="background:${bg};color:${w >= 3 ? '#fff' : 'var(--ink)'}" data-go="c-${m.communities.find((x) => x.c.name === c)?.slug}" title="${esc(c)}: ${esc(s)}, ${it.map((i) => i.criticality).join(', ')}">${it.length > 1 ? it.length : ''}</td>`;
  };
  const sec = [...new Set([...SECTIONS, ...items.map((i) => i.section)])].map((s) => {
    const it = items.filter((i) => i.section === s);
    return { s, total: it.reduce((x, i) => x + i.points, 0), segs: (['Critical', 'Major', 'Minor'] as const).map((c) => ({ v: it.filter((i) => i.criticality === c).reduce((x, i) => x + i.points, 0), color: CRIT_COLOR[c], title: `${c}: ${it.filter((i) => i.criticality === c).length} findings` })) };
  }).filter((x) => x.total).sort((a, b) => b.total - a.total);
  const themes = THEMES.map((t) => ({ t: t.t, n: items.filter((i) => themeOf(i.short) === t.t).length, k: new Set(items.filter((i) => themeOf(i.short) === t.t).map((i) => i.audit.community)).size })).sort((a, b) => b.n - a.n);
  const repeats = [...countBy(m.findings.filter((i) => i.repeat), (i) => i.short)].sort((a, b) => b[1] - a[1]);
  const movers = m.communities.filter((c) => c.score != null && c.prevScore != null).map((c) => ({ c, d: c.score! - c.prevScore! })).sort((a, b) => a.d - b.d);
  const months = [...new Set(m.audits.map((a) => a.date.slice(0, 7)))].sort();

  const LA = latestPerKitchen(A);
  const byScore = [...new Set(LA.map((a) => a.community))].sort((x, y) => (avg(LA.filter((a) => a.community === x).map((a) => a.score)) ?? 101) - (avg(LA.filter((a) => a.community === y).map((a) => a.score)) ?? 101));
  const heat = top('heat', byScore, 5, 'communities');
  const moves = [...movers].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 5).sort((a, b) => b.d - a.d);
  return head('Trends', 'Trends', 'How scores move over time and where points are lost. More charts are folded below.') +
    roundChips(m, v) +
    `<section class="grid two">
      <div class="panel"><h3>Average score by month</h3>${scoreLine(months.map((mo) => ({ x: fmtDate(mo + '-01', true).split(' ')[0], y: avg(m.audits.filter((a) => a.date.startsWith(mo)).map((a) => a.score)) == null ? null : Math.round(avg(m.audits.filter((a) => a.date.startsWith(mo)).map((a) => a.score))!), label: `${mo}, ${m.audits.filter((a) => a.date.startsWith(mo)).length} audits` })))}<p class="axisnote">Dashed lines mark 70 and 85.</p></div>
      <div class="panel"><h3>Where points are lost <span class="sm">top 5 areas</span></h3>${bars(themes.filter((t) => t.n).slice(0, 5).map((t) => ({ label: t.t, value: t.n, act: 'theme:' + t.t, title: `${t.n} findings in ${t.k} communities` })))}<p class="axisnote">Number of findings in each area a visitor walks. Select one to see them.</p></div>
    </section>
    <section class="block folds">
      ${fold('t-heat', 'Communities by area <span class="sm">lowest scores first</span>', themeHeat(m, LA, heat.shown) + heat.more)}
      ${fold('t-round', 'Average score by round', bars(roundRows.map((r) => ({ label: `${r.r} (${r.n} audits)`, value: r.s ?? 0, valueText: pct(r.s), act: 'round:' + r.r, segs: [{ v: r.s ?? 0, color: 'var(--bar)', title: '' }] })), 100) + (roundRows.length < 2 ? '<p class="axisnote">Round over round comparisons fill in once the next round\'s reports are imported.</p>' : ''))}
      ${fold('t-moves', 'Biggest score changes', moves.length ? `<div class="tablewrap"><table><tbody>${moves.map((x) => `<tr class="rowlink" data-go="c-${x.c.slug}"><td>${esc(x.c.c.short || x.c.c.name)}</td><td class="num">${pct(x.c.prevScore)} to ${pct(x.c.score)}</td><td class="num">${delta(x.c.score, x.c.prevScore)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Changes show up once communities have a second audit on file.</p>')}
      ${fold('t-repeat', 'Repeat findings', repeats.length ? bars(repeats.slice(0, 5).map(([s, n]) => ({ label: s, value: n, act: 'repeat:' + s }))) : '<p class="note">No repeats yet. Repeats show up once a kitchen has two audits on file.</p>')}
      ${fold('t-section', 'Points lost by EcoSure section', bars(sec.slice(0, 5).map((s) => ({ label: s.s, value: s.total, act: 'section:' + s.s, segs: s.segs }))) + critLegend())}
      ${fold('t-stds', 'Standards by community heat map', comms.length ? `<div class="tablewrap"><table class="hm"><thead><tr><th>Standard</th>${comms.map((c) => `<th class="rot" data-go="c-${m.communities.find((x) => x.c.name === c)?.slug}">${esc(shortName(m, c))}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
      ${stds.map((s) => `<tr><td class="lab"><button class="linkbtn" data-act="std:${esc(s)}">${esc(s)}</button></td>${comms.map((c) => cell(c, s)).join('')}<td class="num">${items.filter((i) => i.short === s).length}</td></tr>`).join('')}</tbody></table></div>
      <div class="legend"><span><i style="background:var(--hm1)"></i>Minor (1 pt)</span><span><i style="background:var(--hm2)"></i>Major (3 pts)</span><span><i style="background:var(--hm3)"></i>Critical (5 pts) or more</span></div>` : '<div class="empty">No audits in this round yet.</div>')}
    </section>`;
}

/* ---------- import ---------- */
export { importView, settingsView } from './views-admin';
