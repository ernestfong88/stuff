/**
 * Enterprise dashboard: one screen with the program's state, filterable by region.
 * Every tile links to the page with the detail behind it.
 */
import { CRIT_COLOR, bars, scoreLine } from './charts';
import { capMissing, priorities, scoreBand, type Finding, type Model } from './model';
import { plainTitle } from './plain';
import { avg, esc, fmtDate, pct, plural } from './util';
import { inRound, latestPerKitchen, roundChips, scorePill, type ViewState } from './views';
import { communitiesOfFocus } from './views-roles';

let REGION = 'all';
export const setRegion = (r: string) => { REGION = r; };

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
  const good = scored.filter((a) => a.score! >= 85).length, warn = scored.filter((a) => a.score! >= 70 && a.score! < 85).length, bad = scored.filter((a) => a.score! < 70).length;
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
  const panel = (title: string, sub: string, go: string, body: string, span = 6) => `<section class="dpanel span${span}"><header><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${go ? `<button class="linkbtn" data-go="${go}">Details</button>` : ''}</header>${body}</section>`;

  const sevRows = (['Critical', 'Major', 'Minor'] as const).map((x) => {
    const t = remediation(items.filter((f) => f.criticality === x));
    return `<div class="dsev"><span class="dsl"><i style="background:${CRIT_COLOR[x]}"></i>${x}<small>${t.n}</small></span>${bar([{ n: t.done, cls: 'done', label: 'remediated' }, { n: t.prog, cls: 'prog', label: 'in progress' }, { n: t.none, cls: 'none', label: 'no CAP yet' }], `${x}: ${t.done} of ${t.n} remediated`)}<span class="dsp">${pctOf(t.done, t.n)}%</span></div>`;
  }).join('');

  return `<div class="dash">
    <div class="dhead">
      <div><p class="crumb">Kisco Senior Living · Culinary food safety</p><h2 class="page">EcoSure Food Safety Dashboard</h2>
        <p class="note">Latest EcoSure audit of each kitchen${v.round !== 'all' ? ` in ${esc(v.round)}` : ''}. Data through ${fmtDate(latestDate)}: ${plural(m.audits.length, 'kitchen audit')}, ${plural(caps, 'corrective action plan')}. Scores are out of 100; 85 or better is strong, below 70 needs focus.</p></div>
      <div class="pageacts"><button class="btn ghost sm" data-act="share">Copy link</button><button class="btn sm" data-go="home">Executive briefing</button></div>
    </div>
    <div class="dfilters"><span class="lbl">Region</span>${['all', ...regions].map((rg) => `<button class="fbtn" data-act="region:${esc(rg)}" aria-pressed="${REGION === rg}">${rg === 'all' ? 'All regions' : esc(rg)}</button>`).join('')}<span class="grow"></span>${roundChips(m, v).replace('<div class="toolbar">', '<span class="dround">').replace(/<\/div>$/, '</span>')}</div>

    <div class="dkpis">
      ${kpi(pct(s), 'Average score', `${good} kitchens at 85 or better`, scoreBand(s), 'communities')}
      ${kpi(`${auditedComms}<small>/${roster.length}</small>`, 'Communities audited', `${A.length} kitchens`, '', 'communities')}
      ${kpi(String(bad), 'Kitchens below 70', `of ${scored.length} scored`, bad ? 'bad' : 'good', 'communities', ' data-band="bad"')}
      ${kpi(`${pctOf(r.done, r.n)}%`, 'Infractions remediated', `${r.done} of ${r.n}`, pctOf(r.done, r.n) >= 80 ? 'good' : 'warn', 'findings')}
      ${kpi(String(critOpen), 'Critical still open', `of ${items.filter((f) => f.criticality === 'Critical').length} critical`, critOpen ? 'bad' : 'good', 'findings', ' data-crit="Critical"')}
      ${kpi(String(cap.missing), 'CAPs missing', `${cap.closed} of ${cited.length} closed`, cap.missing ? 'bad' : 'good', 'actions', ' data-tab="caps"')}
    </div>

    <div class="dgrid">
      ${panel('Remediation by severity', `${r.n} infractions; remediated means on a CAP EcoSure shows as approved or completed.`, 'findings', `<div class="dsevs">${sevRows}</div><div class="dlegend"><span><i class="done"></i>Remediated</span><span><i class="prog"></i>In progress</span><span><i class="none"></i>No CAP yet</span></div>`)}
      ${panel('Corrective action plans', `${cited.length} kitchens with findings. Due ${m.settings.capDueDays} days after the audit.`, 'actions', stack([{ n: cap.closed, cls: 'done', label: 'Closed' }, { n: cap.open, cls: 'prog', label: 'In progress' }, { n: cap.overdue, cls: 'warn2', label: 'Items past due' }, { n: cap.missing, cls: 'none', label: 'Missing' }], 'CAP status'))}
      ${panel('Score bands', `${scored.length} scored kitchens`, 'communities', stack([{ n: good, cls: 'done', label: '85 or better' }, { n: warn, cls: 'prog', label: '70 to 84' }, { n: bad, cls: 'none', label: 'Below 70' }], 'Score bands'), 4)}
      ${panel('Average score by region', 'Lowest first. Select one to filter.', '', `<div class="bars">${regionRows.map((x) => `<button class="bar${REGION === x.rg ? ' on' : ''}" data-act="region:${esc(REGION === x.rg ? 'all' : x.rg)}" title="${esc(x.rg)}: ${pct(x.s)} across ${x.n} kitchens, ${x.miss} CAP missing"><span class="name">${esc(x.rg)}</span><span class="track"><span class="fill" style="width:${x.s ?? 0}%;background:${x.s == null ? 'var(--line)' : x.s >= 85 ? 'var(--good)' : x.s >= 70 ? 'var(--maj)' : 'var(--crit)'}"></span></span><span class="val">${pct(x.s)}</span></button>`).join('')}</div>`, 4)}
      ${panel('Average score by month', '', 'trends', scoreLine(months.map((mo) => { const ms = auditsInScope.filter((a) => a.date.startsWith(mo)); const a = avg(ms.map((x) => x.score)); return { x: fmtDate(mo + '-01', true).split(' ')[0], y: a == null ? null : Math.round(a), label: `${mo}, ${ms.length} audits` }; }), 420, 150), 4)}
      ${panel('Top 5 issues', 'By points lost', 'priorities', bars(P.map((p) => ({ label: plainTitle(p.short), value: p.kitchens, valueText: `${p.kitchens}`, act: 'std:' + p.short, title: `${plainTitle(p.short)}: ${p.kitchens} kitchens, ${p.points} points lost`, segs: [{ v: p.kitchens, color: CRIT_COLOR[p.crit], title: p.crit }] }))) + '<p class="axisnote">Kitchens cited</p>')}
      ${panel('Communities needing attention', 'Score below 70, 4+ critical, or 3+ repeats', 'communities', focus.length ? `<div class="tablewrap"><table><tbody>${focus.map(({ c, why }) => `<tr class="rowlink" data-go="c-${c.slug}"><td><b>${esc(c.c.name)}</b><span class="sub">${esc(c.c.region ?? '')}</span></td><td class="num">${scorePill(c.score)}</td><td class="why">${esc(why.join(' · '))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="okbox">None in this view.</div>')}
    </div>
  </div>`;
}

