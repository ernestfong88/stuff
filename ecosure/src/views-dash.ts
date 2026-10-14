/**
 * Enterprise dashboard: one screen with the program's state, filterable by region.
 * Every tile links to the page with the detail behind it.
 */
import { CRIT_COLOR, bars, scoreLine } from './charts';
import { capMissing, priorities, type Finding, type Model } from './model';
import { plainTitle } from './plain';
import { avg, esc, fmtDate, pct, plural } from './util';
import { inRound, latestPerKitchen, roundChips, scorePill, type ViewState } from './views';
import { communitiesOfFocus } from './views-roles';
import { top } from './expand';

let REGION = 'all';
export const setRegion = (r: string) => { REGION = r; };
let SORT: 'found' | 'rate' | 'open' = 'found';
export const setDashSort = (x: string) => { SORT = x === 'rate' || x === 'open' ? x : 'found'; };
const SEVS = ['Critical', 'Major', 'Minor'] as const;

const pctOf = (x: number, n: number) => (n ? Math.round((x / n) * 100) : 0);

function remediation(fs: Finding[]) {
  const done = fs.filter((f) => f.capItem && f.audit.capState === 'closed').length;
  const prog = fs.filter((f) => f.capItem && f.audit.capState !== 'closed').length;
  return { n: fs.length, done, prog, none: fs.length - done - prog };
}

type Part = { n: number; cls: string; label: string };
/** One horizontal stacked bar; each part keeps its share of the width. */
function bar(parts: Part[], aria: string): string {
  const total = parts.reduce((s, p) => s + p.n, 0);
  if (!total) return '<div class="dstack empty"></div>';
  return `<div class="dstack" role="img" aria-label="${esc(aria)}">${parts.filter((p) => p.n).map((p) => `<span class="dseg ${p.cls}" style="flex:${p.n}" title="${p.n} ${esc(p.label)} (${pctOf(p.n, total)}%)"></span>`).join('')}</div>`;
}
function stack(parts: Part[], aria: string): string {
  return bar(parts, aria) + `<div class="dlegend">${parts.map((p) => `<span><i class="${p.cls}"></i>${esc(p.label)} <b>${p.n}</b></span>`).join('')}</div>`;
}

export function dashboard(m: Model, v: ViewState): string {
  const regions = [...new Set(m.settings.roster.filter((c) => c.active).map((c) => c.region || 'No region set'))].sort();
  const inReg = (name: string) => REGION === 'all' || (m.settings.roster.find((c) => c.name === name)?.region || 'No region set') === REGION;
  const A = latestPerKitchen(inRound(m, v)).filter((a) => inReg(a.community));
  const all = latestPerKitchen(inRound(m, v));
  const items = A.flatMap((a) => a.items);
  const scored = A.filter((a) => a.score != null);
  const s = avg(scored.map((a) => a.score));
  const roster = m.communities.filter((c) => c.c.active && inReg(c.c.name));
  const auditedComms = new Set(A.map((a) => a.community)).size;
  const r = remediation(items);
  const critOpen = items.filter((f) => f.criticality === 'Critical' && !(f.capItem && f.audit.capState === 'closed')).length;
  const cited = A.filter((a) => a.items.length);
  const cap = {
    closed: cited.filter((a) => a.capState === 'closed').length,
    open: cited.filter((a) => a.capState === 'open').length,
    overdue: cited.filter((a) => a.capState === 'overdue').length,
    missing: cited.filter(capMissing).length,
  };
  const good = scored.filter((a) => a.score! >= 85).length, bad = scored.filter((a) => a.score! < 70).length;
  const P = priorities(A).slice(0, 5);
  const focus = communitiesOfFocus(m).filter(({ c }) => inReg(c.c.name)).slice(0, 5);
  const regionRows = regions.map((rg) => {
    const RA = all.filter((a) => (m.settings.roster.find((c) => c.name === a.community)?.region || 'No region set') === rg);
    return { rg, s: avg(RA.map((a) => a.score)), n: RA.length, miss: RA.filter(capMissing).length };
  }).sort((x, y) => (x.s ?? 101) - (y.s ?? 101));
  const auditsInScope = (v.round === 'all' ? m.audits : m.audits.filter((a) => a.round === v.round)).filter((a) => inReg(a.community));
  const months = [...new Set(auditsInScope.map((a) => a.date.slice(0, 7)))].sort();
  const latestDate = m.audits.reduce((x, a) => (a.date > x ? a.date : x), '');
  const caps = m.audits.filter((a) => a.cap).length;

  const kpi = (val: string, label: string, sub: string, tone: string, go: string, extra = '') => `<button class="dkpi ${tone}" data-go="${go}"${extra}><span class="dl">${label}</span><b>${val}</b><span class="ds">${sub}</span></button>`;
  const panel = (title: string, sub: string, go: string, body: string, span = 6, cls = '') => `<section class="dpanel span${span}${cls ? ' ' + cls : ''}"><header><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${go ? `<button class="linkbtn" data-go="${go}">Details</button>` : ''}</header>${body}</section>`;

  const meter = (done: number, n: number) => `<span class="dmeter"><span style="width:${pctOf(done, n)}%"></span></span>`;
  const rateCell = (done: number, n: number) => `<td class="drate"><div>${meter(done, n)}<b>${n ? pctOf(done, n) + '%' : '–'}</b></div></td>`;

  // Program impact: what EcoSure identified, by criticality, and how much is remediated.
  const sevT = SEVS.map((x) => ({ x, ...remediation(items.filter((f) => f.criticality === x)) }));
  const critT = sevT[0];
  const fullyFixed = cited.filter((a) => a.capState === 'closed').length;
  const actions = items.filter((f) => f.capItem?.action).length;
  const sevTable = `<table class="dimpact"><thead><tr><th>Criticality</th><th class="num">Identified</th><th class="num">Remediated</th><th class="num hide-s">In progress</th><th class="num hide-s">No CAP yet</th><th>Remediation rate</th></tr></thead><tbody>
    ${sevT.map((t) => `<tr class="rowlink" data-go="findings" data-crit="${t.x}"><td><span class="dsl"><i style="background:${CRIT_COLOR[t.x]}"></i>${t.x}</span></td><td class="num">${t.n}</td><td class="num good">${t.done}</td><td class="num hide-s">${t.prog}</td><td class="num hide-s">${t.none}</td>${rateCell(t.done, t.n)}</tr>`).join('')}
    <tr class="total"><td>Total</td><td class="num">${r.n}</td><td class="num good">${r.done}</td><td class="num hide-s">${r.prog}</td><td class="num hide-s">${r.none}</td>${rateCell(r.done, r.n)}</tr></tbody></table>`;

  // Drill-down: the same numbers for each community.
  const byComm = [...new Set(A.map((a) => a.community))].map((name) => {
    const CA = A.filter((a) => a.community === name), fs = CA.flatMap((a) => a.items), t = remediation(fs);
    const cv = m.communities.find((c) => c.c.name === name);
    return { name, slug: cv?.slug ?? '', region: cv?.c.region ?? '', kitchens: CA.length, crit: fs.filter((f) => f.criticality === 'Critical').length, maj: fs.filter((f) => f.criticality === 'Major').length, min: fs.filter((f) => f.criticality === 'Minor').length, ...t, miss: CA.some(capMissing) };
  }).sort((a, b) => SORT === 'rate' ? pctOf(a.done, a.n) - pctOf(b.done, b.n) || b.n - a.n : SORT === 'open' ? (b.n - b.done) - (a.n - a.done) : b.n - a.n || a.name.localeCompare(b.name));
  const { shown, more } = top('dash-comm', byComm, 5, 'communities');
  const sortBtn = (k: string, l: string) => `<button class="fbtn" data-act="dsort:${k}" aria-pressed="${SORT === k}">${l}</button>`;
  const commTable = `<div class="toolbar"><span class="lbl">Sort</span>${sortBtn('found', 'Most identified')}${sortBtn('open', 'Most still open')}${sortBtn('rate', 'Lowest rate')}</div>
    <div class="tablewrap"><table class="dcomm"><thead><tr><th>Community</th><th class="num hide-s" title="Critical">Crit.</th><th class="num hide-s" title="Major">Major</th><th class="num hide-s" title="Minor">Minor</th><th class="num">Identified</th><th class="num">Remediated</th><th>Rate</th></tr></thead><tbody>
    ${shown.map((c) => `<tr class="rowlink" data-go="c-${c.slug}"><td><b>${esc(c.name)}</b><span class="sub">${esc(c.region)}${c.kitchens > 1 ? ` · ${c.kitchens} kitchens` : ''}${c.miss ? ' · <span class="captag">CAP missing</span>' : ''}</span></td><td class="num hide-s">${c.crit}</td><td class="num hide-s">${c.maj}</td><td class="num hide-s">${c.min}</td><td class="num">${c.n}</td><td class="num good">${c.done}</td>${rateCell(c.done, c.n)}</tr>`).join('')}
    </tbody></table></div>${more}`;
  const regRem = regions.map((rg) => { const fs = all.filter((a) => (m.settings.roster.find((c) => c.name === a.community)?.region || 'No region set') === rg).flatMap((a) => a.items); return { rg, ...remediation(fs) }; })
    .sort((a, b) => pctOf(b.done, b.n) - pctOf(a.done, a.n));
  const regTable = `<div class="dregs">${regRem.map((x) => `<button class="dreg${REGION === x.rg ? ' on' : ''}" data-act="region:${esc(REGION === x.rg ? 'all' : x.rg)}"><span class="name">${esc(x.rg)}</span><span class="xs">${x.done} of ${x.n} remediated</span>${meter(x.done, x.n)}<b>${pctOf(x.done, x.n)}%</b></button>`).join('')}</div>`;

  return `<div class="dash">
    <div class="dhead">
      <div><p class="crumb">Kisco Senior Living · Culinary food safety</p><h2 class="page">EcoSure Food Safety Dashboard</h2>
        <p class="note">EcoSure is the independent food safety audit of every Kisco kitchen. Latest audit of each kitchen${v.round !== 'all' ? ` in ${esc(v.round)}` : ''}, data through ${fmtDate(latestDate)} (${plural(m.audits.length, 'audit')}, ${plural(caps, 'corrective action plan')}).</p></div>
      <div class="pageacts"><button class="btn ghost sm" data-act="share">Copy link</button><button class="btn sm" data-go="home">Executive briefing</button></div>
    </div>
    <div class="dfilters"><span class="lbl">Region</span>${['all', ...regions].map((rg) => `<button class="fbtn" data-act="region:${esc(rg)}" aria-pressed="${REGION === rg}">${rg === 'all' ? 'All regions' : esc(rg)}</button>`).join('')}<span class="grow"></span>${roundChips(m, v).replace('<div class="toolbar">', '<span class="dround">').replace(/<\/div>$/, '</span>')}</div>

    <section class="dhero" aria-label="Program impact">
      <p class="dhl">EcoSure identified <b>${r.n}</b> food safety violations in ${plural(A.length, 'kitchen')}${REGION !== 'all' ? ` in ${esc(REGION)}` : ''}. Our teams have remediated <b class="good">${r.done} (${pctOf(r.done, r.n)}%)</b>, including <b>${critT.done} of ${critT.n}</b> critical.</p>
      <div class="dbig">
        <div><span class="dl">Violations identified</span><b>${r.n}</b><span class="ds">${sevT.map((t) => `<span class="dsl"><i style="background:${CRIT_COLOR[t.x]}"></i>${t.n} ${t.x.toLowerCase()}</span>`).join('')}</span></div>
        <div class="good"><span class="dl">Remediated</span><b>${r.done}</b><span class="ds">verified closed by EcoSure</span></div>
        <div class="${pctOf(r.done, r.n) >= 80 ? 'good' : 'warn'}"><span class="dl">Remediation rate</span><b>${pctOf(r.done, r.n)}%</b>${meter(r.done, r.n)}</div>
        <div><span class="dl">Still open</span><b>${r.prog + r.none}</b><span class="ds">${r.prog} in progress · ${r.none} with no CAP yet</span></div>
      </div>
      ${sevTable}
      <ul class="dwins">
        <li><b>${critT.done}</b> critical violations fixed</li>
        <li><b>${fullyFixed}</b> of ${cited.length} kitchens fully remediated</li>
        <li><b>${actions}</b> corrective actions written by community teams</li>
        <li><b>${pct(s)}</b> average score${scored.length ? `, ${good} kitchens at 85 or better` : ''}</li>
      </ul>
      <p class="xs dnote">Remediated means the violation is on a corrective action plan that EcoSure shows as approved or completed. Select a row to see the violations.</p>
    </section>

    <div class="dgrid">
      ${panel('Remediation by community', 'Select a community for its findings, photos and plan.', 'communities', commTable, 8)}
      ${panel('Remediation by region', 'Highest first. Select one to filter.', '', regTable, 4, 'dregp')}
    </div>

    <h3 class="dsect">Where things stand</h3>
    <div class="dkpis four">
      ${kpi(`${auditedComms}<small>/${roster.length}</small>`, 'Communities audited', `${A.length} kitchens`, '', 'communities')}
      ${kpi(String(bad), 'Kitchens below 70', `of ${scored.length} scored`, bad ? 'bad' : 'good', 'communities', ' data-band="bad"')}
      ${kpi(String(critOpen), 'Critical still open', `of ${critT.n} critical`, critOpen ? 'bad' : 'good', 'findings', ' data-crit="Critical"')}
      ${kpi(String(cap.missing), 'CAPs missing', `${cap.closed} of ${cited.length} closed`, cap.missing ? 'bad' : 'good', 'actions', ' data-tab="caps"')}
    </div>

    <div class="dgrid">
      ${panel('Corrective action plans', `${cited.length} kitchens with findings. Due ${m.settings.capDueDays} days after the audit.`, 'actions', stack([{ n: cap.closed, cls: 'done', label: 'Closed' }, { n: cap.open, cls: 'prog', label: 'In progress' }, { n: cap.overdue, cls: 'warn2', label: 'Items past due' }, { n: cap.missing, cls: 'none', label: 'Missing' }], 'CAP status'), 4)}
      ${panel('Average score by region', 'Lowest first. Select one to filter.', '', `<div class="bars">${regionRows.map((x) => `<button class="bar${REGION === x.rg ? ' on' : ''}" data-act="region:${esc(REGION === x.rg ? 'all' : x.rg)}" title="${esc(x.rg)}: ${pct(x.s)} across ${x.n} kitchens, ${x.miss} CAP missing"><span class="name">${esc(x.rg)}</span><span class="track"><span class="fill" style="width:${x.s ?? 0}%;background:${x.s == null ? 'var(--line)' : x.s >= 85 ? 'var(--good)' : x.s >= 70 ? 'var(--maj)' : 'var(--crit)'}"></span></span><span class="val">${pct(x.s)}</span></button>`).join('')}</div>`, 4)}
      ${panel('Average score by month', '', 'trends', scoreLine(months.map((mo) => { const ms = auditsInScope.filter((a) => a.date.startsWith(mo)); const a = avg(ms.map((x) => x.score)); return { x: fmtDate(mo + '-01', true).split(' ')[0], y: a == null ? null : Math.round(a), label: `${mo}, ${ms.length} audits` }; }), 420, 150), 4)}
      ${panel('Top 5 issues', 'By points lost', 'priorities', bars(P.map((p) => ({ label: plainTitle(p.short), value: p.kitchens, valueText: `${p.kitchens}`, act: 'std:' + p.short, title: `${plainTitle(p.short)}: ${p.kitchens} kitchens, ${p.points} points lost`, segs: [{ v: p.kitchens, color: CRIT_COLOR[p.crit], title: p.crit }] }))) + '<p class="axisnote">Kitchens cited</p>')}
      ${panel('Communities needing attention', 'Score below 70, 4+ critical, or 3+ repeats', 'communities', focus.length ? `<div class="tablewrap"><table><tbody>${focus.map(({ c, why }) => `<tr class="rowlink" data-go="c-${c.slug}"><td><b>${esc(c.c.name)}</b><span class="sub">${esc(c.c.region ?? '')}</span></td><td class="num">${scorePill(c.score)}</td><td class="why">${esc(why.join(' · '))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="okbox">None in this view.</div>')}
    </div>
  </div>`;
}

