/**
 * Enterprise dashboard: the program's impact at a glance, filterable by region.
 * Every number and panel links to the page with the detail behind it.
 */
import { CRIT_COLOR } from './charts';
import { type Model } from './model';
import { avg, esc, fmtDate, pct } from './util';
import { inRound, latestPerKitchen, roundChips, scorePill, type ViewState } from './views';
import { communitiesOfFocus } from './views-roles';
import { fixCard, snapshot, snapshotDid, stepsCard } from './views-brief';

let REGION = 'all';
export const setRegion = (r: string) => { REGION = r; };
const SEVS = ['Critical', 'Major', 'Minor'] as const;

const pctOf = (x: number, n: number) => (n ? Math.round((x / n) * 100) : 0);

/** The region filter the reader picked, for the dashboard and its copied email. */
export function regionFilter(m: Model): { inReg: (name: string) => boolean; region: string; regionOf: (name: string) => string } {
  const regionOf = (name: string) => m.settings.roster.find((c) => c.name === name)?.region || 'No region set';
  return { inReg: (name) => REGION === 'all' || regionOf(name) === REGION, region: REGION === 'all' ? '' : REGION, regionOf };
}

export function dashboard(m: Model, v: ViewState): string {
  const { inReg, regionOf } = regionFilter(m);
  const regions = [...new Set(m.settings.roster.filter((c) => c.active).map((c) => c.region || 'No region set'))].sort();
  const all = latestPerKitchen(inRound(m, v));
  const A = all.filter((a) => inReg(a.community));
  const items = A.flatMap((a) => a.items);
  const sn = snapshot(m, v, inReg);
  const latestDate = m.audits.reduce((x, a) => (a.date > x ? a.date : x), '');

  // Communities of focus: the qualifying reasons from the latest quarterly audit, without status detail.
  const focusAll = communitiesOfFocus(m).filter(({ c }) => inReg(c.c.name)).sort((a, b) => (a.c.score ?? 101) - (b.c.score ?? 101));
  const focus = focusAll.slice(0, 5).map(({ c, why }) => ({ c, why: why.filter((w) => /critical|repeat/.test(w)) }));
  const regionRows = regions.map((rg) => ({ rg, s: avg(all.filter((a) => regionOf(a.community) === rg).map((a) => a.score)) }))
    .sort((x, y) => (x.s ?? 101) - (y.s ?? 101));

  const panel = (title: string, sub: string, go: string, body: string) => `<section class="dpanel span6"><header><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${go ? `<button class="linkbtn" data-go="${go}">Details</button>` : ''}</header>${body}</section>`;
  const sev = SEVS.map((x) => ({ x, n: items.filter((f) => f.criticality === x).length }));

  return `<div class="dash">
    <div class="dhead">
      <div><p class="crumb">Kisco Senior Living · Culinary food safety</p><h2 class="page">EcoSure Food Safety Dashboard</h2>
        <p class="note">Latest EcoSure audit of each kitchen · data through ${fmtDate(latestDate)}</p></div>
      <div class="pageacts"><button class="btn ghost sm" data-act="share">Copy link</button><button class="btn sm" data-act="copy-summary">Copy as email</button></div>
    </div>
    <div class="dfilters"><span class="lbl">Region</span>${['all', ...regions].map((rg) => `<button class="fbtn" data-act="region:${esc(rg)}" aria-pressed="${REGION === rg}">${rg === 'all' ? 'All regions' : esc(rg)}</button>`).join('')}<span class="grow"></span>${roundChips(m, v).replace('<div class="toolbar">', '<span class="dround">').replace(/<\/div>$/, '</span>')}</div>

    <section class="dhero" aria-label="Quarter snapshot">
      <p class="dhl">This quarter EcoSure found <b>${sn.found} violations</b> across ${sn.kitchens} kitchens. Our teams have remediated <b class="good">${sn.rate}%</b> of them.</p>
      <div class="dbig">
        <button data-go="findings"><span class="dl">Violations identified</span><b>${sn.found}</b></button>
        <button class="good" data-go="findings"><span class="dl">Remediated</span><b>${sn.done}</b></button>
        <div class="good"><span class="dl">Remediation rate</span><b>${sn.rate}%</b><span class="dmeter"><span style="width:${sn.rate}%"></span></span></div>
      </div>
      <div class="dmix"><span class="dl">Violations by criticality</span>
        <div class="dmixbar" role="img" aria-label="${sev.map((t) => `${t.n} ${t.x}`).join(', ')}">${sev.filter((t) => t.n).map((t) => `<button style="flex:${t.n};background:${CRIT_COLOR[t.x]}" data-go="findings" data-crit="${t.x}" title="${t.n} ${t.x.toLowerCase()} (${pctOf(t.n, sn.found)}%)"></button>`).join('')}</div>
        <div class="dmixlab">${sev.map((t) => `<button data-go="findings" data-crit="${t.x}"><i style="background:${CRIT_COLOR[t.x]}"></i>${t.x} <b>${t.n}</b> <span>${pctOf(t.n, sn.found)}%</span></button>`).join('')}</div>
      </div>
      ${sn.top.length ? `<div class="dtop3"><span class="dl">Top 3 challenges and what teams did</span><ol>${sn.top.map((t) => `<li><b>${esc(t.title)}</b><span class="xs">${t.kitchens} kitchens</span><span class="did">${esc(snapshotDid(t.did))}</span></li>`).join('')}</ol></div>` : ''}
    </section>

    <div class="dgrid">
      ${panel('Communities of focus', `${focusAll.length > 5 ? `Lowest 5 of ${focusAll.length}` : 'From the latest quarterly audit'}: score below 70, 4+ critical or 3+ repeats`, 'communities', focus.length ? `<div class="tablewrap"><table class="dfocus"><tbody>${focus.map(({ c, why }) => `<tr class="rowlink" data-go="c-${c.slug}"><td><b>${esc(c.c.name)}</b><span class="sub">${esc([c.c.region ?? '', ...why].filter(Boolean).join(' · '))}</span></td><td class="num">${scorePill(c.score)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="okbox">None in this view.</div>')}
      ${panel('Average score by region', 'Select one to filter', '', `<div class="bars">${regionRows.map((x) => `<button class="bar${REGION === x.rg ? ' on' : ''}" data-act="region:${esc(REGION === x.rg ? 'all' : x.rg)}"><span class="name">${esc(x.rg)}</span><span class="track"><span class="fill" style="width:${x.s ?? 0}%;background:${x.s == null ? 'var(--line)' : x.s >= 85 ? 'var(--good)' : x.s >= 70 ? 'var(--maj)' : 'var(--crit)'}"></span></span><span class="val">${pct(x.s)}</span></button>`).join('')}</div>`)}
    </div>

    ${fixCard(m, v, inReg)}
    ${stepsCard(m, v, inReg)}
  </div>`;
}
