/** Page renderers. Each returns HTML for <main>; main.ts wires the events. */
import { THEMES, SECTIONS, themeOf } from './catalog';
import { CRIT_COLOR, bars, critLegend, scoreLine, spark } from './charts';
import {
  AUDIT_LABEL, AUDIT_TONE, CAP_LABEL, CAP_TONE, needsAudit, needsCap, scoreBand,
  type Audit, type CommunityView, type Finding, type Model,
} from './model';
import { fileUrl, photoUrl } from './store';
import type { Crit } from './types';
import { avg, countBy, daysBetween, esc, fmtDate, pct, plural } from './util';

export interface Filters {
  community: string;
  kitchen: string;
  section: string;
  theme: string;
  crit: string;
  cap: string; // all | has | none | open
  std: string;
  q: string;
  repeat: boolean;
  photos: boolean;
  limit: number;
}
export const emptyFilters = (): Filters => ({ community: 'all', kitchen: 'all', section: 'all', theme: 'all', crit: 'all', cap: 'all', std: '', q: '', repeat: false, photos: false, limit: 40 });

export interface ViewState {
  round: string; // 'all' or a round name
  f: Filters;
  sort: { key: string; dir: 1 | -1 };
  commFilter: string;
  actionTab: 'audits' | 'caps';
  canWrite: boolean;
  mode: 'shared' | 'local' | 'starting';
  capEdit: string | null; // audit key with the CAP form open
}

/* ---------- small pieces ---------- */
export const scorePill = (s: number | null) => `<span class="score s-${scoreBand(s)}">${pct(s)}</span>`;
const chip = (tone: string, text: string, title = '') => `<span class="chip t-${tone}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;
export const capChip = (a: Audit) => chip(CAP_TONE[a.capState], a.capState === 'missing' ? `CAP due ${fmtDate(a.capDue, true)}` : CAP_LABEL[a.capState], a.cap ? `EcoSure status: ${a.cap.status}` : '');
const auditChip = (c: CommunityView) => chip(AUDIT_TONE[c.auditState], AUDIT_LABEL[c.auditState]);
const critChip = (c: Crit) => `<span class="chip c-${c}">${c}</span>`;
function delta(cur: number | null, prev: number | null): string {
  if (cur == null || prev == null) return '<span class="delta flat">no prior</span>';
  const d = Math.round(cur - prev);
  return `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '+' : ''}${d}</span>`;
}
const head = (crumb: string, title: string, lede: string) => `<p class="crumb">${esc(crumb)}</p><h2 class="page">${esc(title)}</h2><p class="lede">${lede}</p>`;
const kitchenLabel = (a: Audit, m: Model) => (m.bySlug.get(a.slug)?.c.kitchens.length ?? 1) > 1 || a.kitchen !== 'Main Kitchen' ? `${a.community}, ${a.kitchen}` : a.community;
const shortName = (m: Model, name: string) => m.settings.roster.find((c) => c.name === name)?.short || name;

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
function latestPerKitchen(audits: Audit[]): Audit[] {
  const m = new Map<string, Audit>();
  for (const a of audits) { const k = a.community + '|' + a.kitchen; const p = m.get(k); if (!p || a.date > p.date) m.set(k, a); }
  return [...m.values()];
}

/* ---------- overview ---------- */
export function overview(m: Model, v: ViewState): string {
  const A = latestPerKitchen(inRound(m, v));
  const scored = A.filter((a) => a.score != null);
  const comms = new Set(A.map((a) => a.community));
  const roster = m.communities.filter((c) => c.c.active);
  const capNeeded = A.filter((a) => a.items.length);
  const closed = capNeeded.filter((a) => a.capState === 'closed').length;
  const na = needsAudit(m), nc = needsCap(m);
  const cur = m.currentRound;
  const range = A.length ? `${fmtDate(A.reduce((x, a) => (a.date < x ? a.date : x), A[0].date), true)} to ${fmtDate(A.reduce((x, a) => (a.date > x ? a.date : x), A[0].date))}` : '';
  const f = A.flatMap((a) => a.items);
  const byComm = [...comms].map((c) => ({ c, s: avg(A.filter((a) => a.community === c).map((a) => a.score)) })).sort((x, y) => (x.s ?? 101) - (y.s ?? 101));
  const top = [...countBy(f, (i) => i.short)].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const critOf = (s: string) => f.find((i) => i.short === s)?.criticality ?? 'Minor';

  return head('Portfolio', 'Portfolio at a glance',
    `${plural(A.length, 'kitchen audit')} across ${plural(comms.size, 'community', 'communities')}${range ? `, ${range}` : ''}. ${cur ? `The current round is <b>${esc(cur.name)}</b> (${fmtDate(cur.start, true)} to ${fmtDate(cur.end)}).` : ''}`) +
    roundChips(m, v) +
    `<div class="grid kpis">
      <div class="kpi ${scoreBand(avg(scored.map((a) => a.score)))}"><div class="v">${pct(avg(scored.map((a) => a.score)))}</div><div class="l">Average score (latest per kitchen)</div></div>
      <button class="kpi" data-go="communities"><div class="v">${comms.size}<small> of ${roster.length}</small></div><div class="l">Communities audited</div></button>
      <button class="kpi ${scored.filter((a) => (a.score ?? 100) < 70).length ? 'bad' : 'good'}" data-go="communities" data-band="bad"><div class="v">${scored.filter((a) => (a.score ?? 100) < 70).length}</div><div class="l">Kitchens below 70</div></button>
      <button class="kpi ${f.some((i) => i.criticality === 'Critical') ? 'bad' : ''}" data-go="findings" data-crit="Critical"><div class="v">${f.filter((i) => i.criticality === 'Critical').length}</div><div class="l">Critical findings</div></button>
      <button class="kpi ${closed === capNeeded.length ? 'good' : 'warn'}" data-go="actions" data-tab="caps"><div class="v">${closed}<small> of ${capNeeded.length}</small></div><div class="l">CAPs closed</div></button>
    </div>
    <section class="block grid two">
      <div class="panel"><h3>Needs an audit <span class="sm">${na.length} of ${roster.length} communities</span></h3>${auditList(na.slice(0, 8), m)}${na.length > 8 ? `<p class="more"><button class="btn ghost sm" data-go="actions" data-tab="audits">See all ${na.length}</button></p>` : ''}</div>
      <div class="panel"><h3>Needs a CAP or follow-up <span class="sm">${plural(nc.length, 'kitchen')}</span></h3>${capList(nc.slice(0, 8), m)}${nc.length > 8 ? `<p class="more"><button class="btn ghost sm" data-go="actions" data-tab="caps">See all ${nc.length}</button></p>` : ''}</div>
    </section>
    <section class="block grid two">
      <div class="panel"><h3>Score by community <span class="sm">lowest first</span></h3>${bars(byComm.map(({ c, s }) => ({ label: shortName(m, c), value: s ?? 0, valueText: pct(s), go: 'c-' + (m.communities.find((x) => x.c.name === c)?.slug ?? ''), segs: [{ v: s ?? 0, color: s == null ? 'var(--line)' : s >= 85 ? 'var(--good)' : s >= 70 ? 'var(--maj)' : 'var(--crit)', title: '' }] })), 100)}
        <div class="legend"><span><i style="background:var(--good)"></i>85 and up</span><span><i style="background:var(--maj)"></i>70 to 84</span><span><i style="background:var(--crit)"></i>Below 70</span></div></div>
      <div class="panel"><h3>Most cited standards <span class="sm">kitchens cited</span></h3>${bars(top.map(([s, n]) => ({ label: s, value: n, act: 'std:' + s, segs: [{ v: n, color: CRIT_COLOR[critOf(s)], title: critOf(s) }] })))}${critLegend()}<p class="axisnote">Select a standard to see every finding behind it.</p></div>
    </section>`;
}

function auditList(list: CommunityView[], m: Model): string {
  if (!list.length) return '<div class="okbox">Every active community has been audited this round.</div>';
  return `<div class="tablewrap"><table><tbody>${list.map((c) => `<tr class="rowlink" data-go="c-${c.slug}"><td><b>${esc(c.c.name)}</b><span class="sub">${esc(auditWhy(c, m))}</span></td><td class="num">${scorePill(c.score)}</td><td>${auditChip(c)}</td></tr>`).join('')}</tbody></table></div>`;
}

export function auditWhy(c: CommunityView, m: Model): string {
  if (c.c.note) return c.c.note;
  if (!c.lastDate) return 'No EcoSure audit on file.';
  const last = `Last audited ${fmtDate(c.lastDate)} (${c.daysSince} days ago)`;
  if (c.auditState === 'overdue') return `${last}. Past the ${m.settings.cycleDays} day cycle since ${fmtDate(c.nextDue)}.`;
  if (c.auditState === 'due') return `${last}. Not yet audited in ${m.currentRound?.name ?? 'this round'}${c.score != null && c.score < 70 ? '; scored below 70 last time' : ''}.`;
  return last + '.';
}

function capList(list: Audit[], m: Model): string {
  if (!list.length) return '<div class="okbox">Every cited kitchen has a closed CAP.</div>';
  return `<div class="tablewrap"><table><tbody>${list.map((a) => `<tr class="rowlink" data-go="c-${a.slug}"><td><b>${esc(kitchenLabel(a, m))}</b><span class="sub">${esc(capWhy(a, m))}</span></td><td class="num">${scorePill(a.score)}</td><td>${capChip(a)}</td></tr>`).join('')}</tbody></table></div>`;
}

export function capWhy(a: Audit, m: Model): string {
  const n = plural(a.items.length, 'finding');
  if (!a.cap) return `Audited ${fmtDate(a.date)}, ${n}. ${a.capState === 'late' ? `CAP was due ${fmtDate(a.capDue)} (${daysBetween(a.capDue, m.today)} days ago).` : `CAP due ${fmtDate(a.capDue)}.`}`;
  const sub = a.cap.submitted ? `submitted ${fmtDate(a.cap.submitted)}` : 'not submitted';
  const due = a.pastDueItems ? `; ${plural(a.pastDueItems, 'item')} past the due date` : '';
  return `Audited ${fmtDate(a.date)}, ${n}. EcoSure status ${a.cap.status}, ${sub}${due}.`;
}

/* ---------- action list ---------- */
export function actions(m: Model, v: ViewState): string {
  const na = needsAudit(m), nc = needsCap(m);
  const tab = v.actionTab;
  const body = tab === 'audits'
    ? (na.length ? `<div class="tablewrap"><table><thead><tr><th>Community</th><th>City</th><th>Status</th><th>Last audit</th><th class="num">Days since</th><th class="num">Last score</th><th>Why</th></tr></thead><tbody>${na.map((c) => `<tr class="rowlink" data-go="c-${c.slug}"><td><b>${esc(c.c.name)}</b></td><td>${esc(c.c.city)}</td><td>${auditChip(c)}</td><td>${c.lastDate ? fmtDate(c.lastDate) : 'Never'}</td><td class="num">${c.daysSince ?? ''}</td><td class="num">${scorePill(c.score)}</td><td class="why">${esc(auditWhy(c, m))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="okbox">Every active community has been audited this round.</div>')
    : (nc.length ? `<div class="tablewrap"><table><thead><tr><th>Kitchen</th><th>Audit</th><th class="num">Score</th><th class="num">Findings</th><th>CAP</th><th>EcoSure status</th><th>Owner</th><th>Detail</th></tr></thead><tbody>${nc.map((a) => `<tr class="rowlink" data-go="c-${a.slug}"><td><b>${esc(kitchenLabel(a, m))}</b></td><td>${fmtDate(a.date)}</td><td class="num">${scorePill(a.score)}</td><td class="num">${a.items.length}${a.crit ? ` <span class="sub">${a.crit} critical</span>` : ''}</td><td>${capChip(a)}</td><td>${esc(a.cap?.status ?? 'None on file')}</td><td>${esc(a.cap?.items.find((i) => i.owner)?.owner ?? a.manager)}</td><td class="why">${esc(capWhy(a, m))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="okbox">Every cited kitchen has a closed CAP.</div>');
  return head('Action list', 'Who needs what',
    `Communities that still need an EcoSure audit in ${esc(m.currentRound?.name ?? 'the current round')}, and kitchens whose Corrective Action Plan is missing, late or still open. A CAP counts as closed when EcoSure shows it as Approved or Completed. CAPs are expected ${m.settings.capDueDays} days after the audit; change this in Settings.`) +
    `<div class="toolbar"><button class="fbtn" data-tab="audits" aria-pressed="${tab === 'audits'}">Needs an audit<span class="n">${na.length}</span></button><button class="fbtn" data-tab="caps" aria-pressed="${tab === 'caps'}">Needs a CAP or follow-up<span class="n">${nc.length}</span></button><span class="grow"></span><button class="btn ghost sm" data-act="csv-actions">Download CSV</button></div>` + body;
}

/* ---------- communities ---------- */
export function communities(m: Model, v: ViewState): string {
  const q = v.commFilter.toLowerCase();
  type Row = { c: CommunityView; score: number | null; prev: number | null; f: number; crit: number; rep: number; last: string };
  let rows: Row[] = m.communities.filter((c) => c.c.active || c.audits.length).map((c) => {
    const A = latestPerKitchen(v.round === 'all' ? c.audits : c.audits.filter((a) => a.round === v.round));
    return { c, score: avg(A.map((a) => a.score)), prev: c.prevScore, f: A.reduce((s, a) => s + a.items.length, 0), crit: A.reduce((s, a) => s + a.crit, 0), rep: A.reduce((s, a) => s + a.items.filter((i) => i.repeat).length, 0), last: c.lastDate };
  });
  if (q) rows = rows.filter((r) => (r.c.c.name + ' ' + r.c.c.city).toLowerCase().includes(q));
  if (v.f.community === 'band:bad') rows = rows.filter((r) => r.score != null && r.score < 70);
  const k = v.sort.key, d = v.sort.dir;
  const val = (r: Row): string | number => ({ name: r.c.c.name, city: r.c.c.city, score: r.score ?? -1, delta: r.score != null && r.prev != null ? r.score - r.prev : -999, f: r.f, crit: r.crit, rep: r.rep, last: r.last, audit: r.c.auditState, cap: r.c.capState })[k] ?? r.c.c.name;
  rows.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * d; });
  const th = (key: string, label: string, cls = '') => `<th class="${cls}" data-sort="${key}">${label}${v.sort.key === key ? ` <span class="arr">${v.sort.dir === 1 ? '▲' : '▼'}</span>` : ''}</th>`;
  return head('Communities', 'Community scorecard', 'Latest audit per kitchen, averaged for communities with more than one kitchen. Select a column to sort, or a row to open the community.') +
    roundChips(m, v) +
    `<div class="toolbar"><input type="search" id="commq" placeholder="Search by community or city" value="${esc(v.commFilter)}" aria-label="Search communities">${v.f.community === 'band:bad' ? '<button class="fbtn" aria-pressed="true" data-act="clear-band">Below 70 only ✕</button>' : ''}<span class="grow"></span><button class="btn ghost sm" data-act="csv-communities">Download CSV</button></div>
    <div class="tablewrap"><table><thead><tr>${th('name', 'Community')}${th('city', 'City')}<th>Kitchens</th>${th('last', 'Last audit')}${th('score', 'Score', 'num')}${th('delta', 'Change', 'num')}<th>Trend</th>${th('f', 'Findings', 'num')}${th('crit', 'Critical', 'num')}${th('rep', 'Repeats', 'num')}${th('audit', 'Audit status')}${th('cap', 'CAP status')}</tr></thead><tbody>
    ${rows.map((r) => `<tr class="rowlink" data-go="c-${r.c.slug}"><td><b>${esc(r.c.c.name)}</b></td><td>${esc(r.c.c.city)}</td><td class="c">${r.c.latest.length || r.c.c.kitchens.length || 1}</td><td>${r.last ? fmtDate(r.last) : '<span class="note">None</span>'}</td><td class="num">${scorePill(r.score)}</td><td class="num">${delta(r.score, r.prev)}</td><td>${spark(r.c.audits.filter((a) => a.score != null).map((a) => a.score!))}</td><td class="num">${r.f}</td><td class="num">${r.crit}</td><td class="num">${r.rep || ''}</td><td>${auditChip(r.c)}</td><td>${r.c.latest.length ? chip(CAP_TONE[r.c.capState], CAP_LABEL[r.c.capState]) : ''}</td></tr>`).join('')}
    </tbody></table></div><p class="axisnote">Repeats are standards cited again at the same kitchen's next audit. Change compares each kitchen's latest score with the audit before it.</p>`;
}

/* ---------- one community ---------- */
export function community(m: Model, v: ViewState, slugKey: string, auditKey: string | null): string {
  const c = m.bySlug.get(slugKey);
  if (!c) return head('Community', 'Not found', 'This community is not in the data. <button class="linkbtn" data-go="communities">Back to communities</button>');
  const dates = [...new Set(c.audits.map((a) => a.date))].sort().reverse();
  const selDate = auditKey && dates.includes(auditKey) ? auditKey : dates[0];
  const A = c.audits.filter((a) => a.date === selDate).sort((x, y) => x.kitchen.localeCompare(y.kitchen));
  const multiK = new Set(c.audits.map((a) => a.kitchen)).size > 1;
  const items = A.flatMap((a) => a.items);
  const fil = v.f;
  const shown = items.filter((i) => (fil.crit === 'all' || i.criticality === fil.crit) && (fil.kitchen === 'all' || i.audit.kitchen === fil.kitchen));

  const tiles = c.latest.length ? `<div class="tiles">${A.map((a) => `<div class="tile"><span class="l">${esc(a.kitchen)}</span><span class="v ${scoreBand(a.score)}">${a.score == null ? 'Pending' : pct(a.score)}</span><span class="l">${fmtDate(a.date)} · ${plural(a.items.length, 'finding')}</span>${a.items.length ? capChip(a) : ''}</div>`).join('')}
    <div class="tile"><span class="l">Audit status</span>${auditChip(c)}<span class="l">${esc(auditWhy(c, m))}</span></div></div>` : `<div class="empty">${esc(auditWhy(c, m))}</div>`;

  const history = c.audits.filter((a) => a.score != null);
  const kitchens = [...new Set(history.map((a) => a.kitchen))];
  const histChart = kitchens.some((k) => history.filter((a) => a.kitchen === k).length > 1) ? `<section class="block"><h3>Score history</h3><div class="grid two">${kitchens.map((k) => `<div class="panel"><b>${esc(k)}</b>${scoreLine(history.filter((a) => a.kitchen === k).map((a) => ({ x: fmtDate(a.date, true), y: a.score, label: `${k}, ${fmtDate(a.date)}` })))}</div>`).join('')}</div></section>` : '';

  const themeCards = items.length ? `<section class="block"><h3>What to look for on your visit</h3><div class="grid themes">${THEMES.map((t) => {
    const it = items.filter((i) => themeOf(i.short) === t.t);
    if (!it.length) return '';
    const cls = it.some((i) => i.criticality === 'Critical') ? 'p0' : it.some((i) => i.criticality === 'Major') ? 'p1' : '';
    const sh = [...countBy(it, (i) => i.short)];
    return `<div class="theme ${cls}"><b>${esc(t.t)}</b><p>${esc(t.look)}</p><ul>${sh.map(([s, n]) => `<li><span>${esc(s)}</span><span>${n > 1 ? n + 'x' : ''}</span></li>`).join('')}</ul></div>`;
  }).join('')}</div></section>` : '';

  const capForms = v.canWrite ? A.filter((a) => a.items.length || a.cap).map((a) => capForm(a, v)).join('') : '';
  const unmatched = A.filter((a) => a.capUnmatched.length);

  const sources = A.flatMap((a) => [a.report && { what: `${a.kitchen} report`, file: a.report.file, ref: a.report.fileRef, src: a.report.source }, a.cap && { what: `${a.kitchen} CAP (${a.cap.status})`, file: a.cap.file, ref: a.cap.fileRef, src: a.cap.source }]).filter(Boolean) as { what: string; file: string; ref?: string; src: string }[];

  return `<p class="crumb"><button class="linkbtn" data-go="communities">Communities</button> / ${esc(c.c.city)}</p><h2 class="page">${esc(c.c.name)}</h2>` +
    `<div class="meta">${A[0]?.manager ? `<span>Manager: ${esc(A[0].manager)}</span>` : ''}${A[0]?.hdResult ? `<span>Last health inspection: ${esc(A[0].hdResult)}${A[0].hdDate ? ' on ' + esc(fmtDate(A[0].hdDate) || A[0].hdDate) : ''}</span>` : ''}<span>${plural(c.audits.length, 'kitchen audit')} on file</span></div>` +
    (dates.length > 1 ? `<div class="toolbar"><span class="lbl">Audit</span>${dates.map((d) => `<button class="fbtn" data-audit="${d}" aria-pressed="${d === selDate}">${fmtDate(d)}</button>`).join('')}</div>` : '') +
    tiles + histChart + themeCards +
    (items.length ? `<section class="block"><h3>Findings <span class="sm">${fmtDate(selDate)}</span></h3>
      <div class="toolbar"><span class="lbl">Show</span>${['all', 'Critical', 'Major', 'Minor'].map((k) => `<button class="fbtn" data-crit="${k}" aria-pressed="${fil.crit === k}">${k === 'all' ? 'All' : k}<span class="n">${k === 'all' ? items.length : items.filter((i) => i.criticality === k).length}</span></button>`).join('')}
      ${multiK ? `<span class="lbl" style="margin-left:8px">Kitchen</span>${['all', ...A.map((a) => a.kitchen)].map((k) => `<button class="fbtn" data-kitchen="${esc(k)}" aria-pressed="${fil.kitchen === k}">${k === 'all' ? 'All' : esc(k)}</button>`).join('')}` : ''}</div>
      <div class="finds">${shown.map((i) => findingCard(i, m, multiK, false)).join('') || '<div class="empty">No findings match.</div>'}</div></section>` : '') +
    (unmatched.length ? `<section class="block"><div class="warnbox"><b>CAP lines that did not match a finding</b><ul>${unmatched.flatMap((a) => a.capUnmatched.map((x) => `<li>${esc(a.kitchen)}: ${esc(x.cid)} ${esc(x.question)}</li>`)).join('')}</ul></div></section>` : '') +
    (A.some((a) => a.positive.length) ? `<section class="block"><h3>What went well</h3><div class="panel"><ul class="plain">${[...new Set(A.flatMap((a) => a.positive))].map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div></section>` : '') +
    (capForms ? `<section class="block"><h3>Update CAP status</h3><p class="note">Use this when a CAP update arrives by email or in EcoSure before you have the PDF. Importing the CAP PDF later replaces it.</p><div class="grid">${capForms}</div></section>` : '') +
    (sources.length ? `<section class="block"><h3>Source files</h3><ul class="plain">${sources.map((s) => `<li>${esc(s.what)}: ${s.ref ? `<a href="${esc(fileUrl(s.ref))}" target="_blank" rel="noopener">${esc(s.file)}</a>` : esc(s.file)}${s.src === 'legacy' ? ' <span class="note">(from the previous review page)</span>' : ''}</li>`).join('')}</ul></section>` : '');
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
  return `<article class="find"><div class="top"><span class="std">${esc(i.short)}</span>${critChip(i.criticality)}${i.repeat ? '<span class="repeat" title="Also cited at this kitchen\'s previous audit">REPEAT</span>' : ''}${where ? `<span class="where">${where}</span>` : ''}<span class="pts">${i.cid ? esc(i.cid) + ' · ' : ''}${i.points ? '-' + i.points + ' pts' : 'unrated'}</span></div>
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
    (f.section === 'all' || i.section === f.section) &&
    (f.theme === 'all' || themeOf(i.short) === f.theme) &&
    (f.crit === 'all' || i.criticality === f.crit) &&
    (!f.std || i.short === f.std) &&
    (f.cap === 'all' || (f.cap === 'has' && !!i.capItem) || (f.cap === 'none' && !i.capItem) || (f.cap === 'open' && i.audit.capState !== 'closed')) &&
    (!f.repeat || i.repeat) && (!f.photos || i.photos.length > 0) &&
    (!q || [i.short, i.question, i.comment, ...i.findings, i.capItem?.action ?? '', i.audit.community].join(' ').toLowerCase().includes(q)));
}

export function findings(m: Model, v: ViewState): string {
  const f = v.f;
  const list = filterFindings(m, v).sort((a, b) => b.audit.date.localeCompare(a.audit.date) || ['Critical', 'Major', 'Minor', 'Unrated'].indexOf(a.criticality) - ['Critical', 'Major', 'Minor', 'Unrated'].indexOf(b.criticality));
  const comms = [...new Set(m.audits.map((a) => a.community))].sort();
  const sel = (id: string, label: string, val: string, opts: [string, string][]) => `<label class="field"><span class="lbl">${label}</span><select id="${id}" data-filter="${id.replace('f-', '')}">${opts.map(([k, t]) => `<option value="${esc(k)}"${k === val ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const byStd = [...countBy(list, (i) => i.short)].sort((a, b) => b[1] - a[1]);
  const critOf = (s: string) => list.find((i) => i.short === s)?.criticality ?? 'Minor';
  const active = f.community !== 'all' || f.section !== 'all' || f.theme !== 'all' || f.crit !== 'all' || f.cap !== 'all' || f.std || f.q || f.repeat || f.photos;
  return head('Findings', 'Findings explorer', 'Every cited standard across the communities. Combine filters to find patterns, then open a finding\'s community for the full audit.') +
    roundChips(m, v) +
    `<div class="panel"><div class="form">
      ${sel('f-community', 'Community', f.community.startsWith('band:') ? 'all' : f.community, [['all', 'All communities'], ...comms.map((c): [string, string] => [c, c])])}
      ${sel('f-section', 'Section', f.section, [['all', 'All sections'], ...[...new Set([...SECTIONS, ...m.findings.map((i) => i.section)])].map((s): [string, string] => [s, s])])}
      ${sel('f-theme', 'Theme', f.theme, [['all', 'All themes'], ...THEMES.map((t): [string, string] => [t.t, t.t])])}
      ${sel('f-crit', 'Criticality', f.crit, [['all', 'All'], ['Critical', 'Critical'], ['Major', 'Major'], ['Minor', 'Minor'], ['Unrated', 'Unrated']])}
      ${sel('f-cap', 'CAP', f.cap, [['all', 'Any'], ['has', 'Has a CAP action'], ['none', 'No CAP action'], ['open', 'CAP not closed']])}
      <label class="field"><span class="lbl">Search</span><input type="search" id="f-q" data-filter="q" value="${esc(f.q)}" placeholder="ice machine, gaskets, sanitizer"></label>
    </div>
    <div class="toolbar" style="margin:12px 0 0"><button class="fbtn" data-toggle="repeat" aria-pressed="${f.repeat}">Repeat findings only</button><button class="fbtn" data-toggle="photos" aria-pressed="${f.photos}">With photos</button>
      ${f.std ? `<button class="fbtn" aria-pressed="true" data-act="clear-std">${esc(f.std)} ✕</button>` : ''}
      <span class="grow"></span>${active ? '<button class="btn quiet sm" data-act="clear-filters">Clear filters</button>' : ''}<button class="btn ghost sm" data-act="csv-findings">Download CSV</button></div></div>
    <section class="block grid two">
      <div class="panel"><h3>${plural(list.length, 'finding')} <span class="sm">in ${plural(new Set(list.map((i) => i.audit.community)).size, 'community', 'communities')}, ${list.reduce((s, i) => s + i.points, 0)} points lost</span></h3>
        ${bars(['Critical', 'Major', 'Minor', 'Unrated'].map((c) => ({ label: c, value: list.filter((i) => i.criticality === c).length, act: 'crit:' + c, segs: [{ v: list.filter((i) => i.criticality === c).length, color: CRIT_COLOR[c], title: c }] })).filter((r) => r.value))}
        <h3 style="margin-top:18px">By section</h3>${bars([...countBy(list, (i) => i.section)].sort((a, b) => b[1] - a[1]).map(([s, n]) => ({ label: s, value: n, act: 'section:' + s })))}</div>
      <div class="panel"><h3>By standard <span class="sm">select one to narrow</span></h3>${bars(byStd.slice(0, 14).map(([s, n]) => ({ label: s, value: n, act: 'std:' + s, segs: [{ v: n, color: CRIT_COLOR[critOf(s)], title: critOf(s) }] })))}${byStd.length > 14 ? `<p class="axisnote">${byStd.length - 14} more standards in the list below.</p>` : ''}${critLegend()}</div>
    </section>
    <section class="block"><div class="finds">${list.slice(0, f.limit).map((i) => findingCard(i, m, true, true)).join('') || '<div class="empty">No findings match these filters.</div>'}</div>
    ${list.length > f.limit ? `<p class="more"><button class="btn ghost" data-act="more">Show ${Math.min(40, list.length - f.limit)} more of ${list.length - f.limit}</button></p>` : ''}</section>`;
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

  return head('Trends', 'Trends and themes', 'How scores and findings move across rounds, and which standards keep showing up. The heat map and section chart follow the round filter.') +
    roundChips(m, v) +
    `<section class="grid two">
      <div class="panel"><h3>Average score by round</h3>${bars(roundRows.map((r) => ({ label: `${r.r} (${r.n} audits)`, value: r.s ?? 0, valueText: pct(r.s), act: 'round:' + r.r, segs: [{ v: r.s ?? 0, color: 'var(--bar)', title: '' }] })), 100)}
        ${roundRows.length < 2 ? '<p class="axisnote">Round over round comparisons fill in once the next round\'s reports are imported.</p>' : `<div class="tablewrap" style="margin-top:12px"><table><thead><tr><th>Round</th><th class="num">Audits</th><th class="num">Avg score</th><th class="num">Findings per audit</th><th class="num">Critical</th></tr></thead><tbody>${roundRows.map((r) => `<tr><td>${esc(r.r)}</td><td class="num">${r.n}</td><td class="num">${pct(r.s)}</td><td class="num">${r.f.toFixed(1)}</td><td class="num">${r.crit}</td></tr>`).join('')}</tbody></table></div>`}</div>
      <div class="panel"><h3>Score by month</h3>${scoreLine(months.map((mo) => ({ x: fmtDate(mo + '-01', true).split(' ')[0], y: avg(m.audits.filter((a) => a.date.startsWith(mo)).map((a) => a.score)) == null ? null : Math.round(avg(m.audits.filter((a) => a.date.startsWith(mo)).map((a) => a.score))!), label: `${mo}, ${m.audits.filter((a) => a.date.startsWith(mo)).length} audits` })))}<p class="axisnote">Average of all kitchen audits in each month. Dashed lines mark 70 and 85.</p></div>
    </section>
    <section class="block grid two">
      <div class="panel"><h3>Points lost by section</h3>${bars(sec.map((s) => ({ label: s.s, value: s.total, act: 'section:' + s.s, segs: s.segs })))}${critLegend()}</div>
      <div class="panel"><h3>Findings by visit theme</h3>${bars(themes.filter((t) => t.n).map((t) => ({ label: t.t, value: t.n, act: 'theme:' + t.t, title: `${t.n} findings in ${t.k} communities` })))}<p class="axisnote">Themes group standards the way a visitor walks the kitchen.</p></div>
    </section>
    <section class="block"><h3>Standards by community <span class="sm">top ${stds.length} standards, shaded by points lost</span></h3>
      ${comms.length ? `<div class="tablewrap"><table class="hm"><thead><tr><th>Standard</th>${comms.map((c) => `<th class="rot" data-go="c-${m.communities.find((x) => x.c.name === c)?.slug}">${esc(shortName(m, c))}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
      ${stds.map((s) => `<tr><td class="lab"><button class="linkbtn" data-act="std:${esc(s)}">${esc(s)}</button></td>${comms.map((c) => cell(c, s)).join('')}<td class="num">${items.filter((i) => i.short === s).length}</td></tr>`).join('')}</tbody></table></div>
      <div class="legend"><span><i style="background:var(--hm1)"></i>Minor (1 pt)</span><span><i style="background:var(--hm2)"></i>Major (3 pts)</span><span><i style="background:var(--hm3)"></i>Critical (5 pts) or more</span><span>A number means the standard was cited in more than one kitchen.</span></div>` : '<div class="empty">No audits in this round yet.</div>'}</section>
    <section class="block grid two">
      <div class="panel"><h3>Repeat findings <span class="sm">cited again at the next audit</span></h3>${repeats.length ? bars(repeats.slice(0, 10).map(([s, n]) => ({ label: s, value: n, act: 'repeat:' + s }))) : '<p class="note">No repeats yet. Repeats show up once a kitchen has two audits on file.</p>'}</div>
      <div class="panel"><h3>Biggest score changes</h3>${movers.length ? `<div class="tablewrap"><table><tbody>${[...movers.slice(0, 5), ...movers.slice(-5).reverse()].filter((x, i, arr) => arr.indexOf(x) === i).sort((a, b) => b.d - a.d).map((x) => `<tr class="rowlink" data-go="c-${x.c.slug}"><td>${esc(x.c.c.name)}</td><td class="num">${pct(x.c.prevScore)} to ${pct(x.c.score)}</td><td class="num">${delta(x.c.score, x.c.prevScore)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Changes show up once communities have a second audit on file.</p>'}</div>
    </section>`;
}

/* ---------- import ---------- */
export { importView, settingsView } from './views-admin';
