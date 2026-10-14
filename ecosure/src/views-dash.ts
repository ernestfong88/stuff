/**
 * Enterprise dashboard: the program's impact at a glance for the communities the reader picks.
 * Every number and panel links to the page with the detail behind it.
 */
import { CRIT_COLOR } from './charts';
import { type Model } from './model';
import { avg, esc, fmtDate, pct } from './util';
import { inRound, latestPerKitchen, roundChips, scorePill, type ViewState } from './views';
import { communitiesOfFocus } from './views-roles';
import { fixCard, snapshot, snapshotDid, stepsCard } from './views-brief';
import { OPEN, top } from './expand';
import { photoUrl } from './store';
import type { Finding } from './model';

const SEVS = ['Critical', 'Major', 'Minor'] as const;
const pctOf = (x: number, n: number) => (n ? Math.round((x / n) * 100) : 0);

/* The communities the reader picked (null = all). A VP picks their set once; it is remembered in this browser. */
const KEY = 'ecosure.dashCommunities';
let SEL: Set<string> | null = (() => { try { const x = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return Array.isArray(x) ? new Set<string>(x) : null; } catch { return null; } })();
let SELQ = '';
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(SEL ? [...SEL] : null)); } catch { /* storage blocked */ } };
const regionOfC = (c: { region?: string }) => c.region || 'No region set';
const active = (m: Model) => m.settings.roster.filter((c) => c.active);
const chosen = (m: Model) => active(m).filter((c) => !SEL || SEL.has(c.name)).map((c) => c.name);

function setSel(m: Model, names: string[] | null): void {
  const all = active(m).map((c) => c.name);
  SEL = names && !all.every((n) => names.includes(n)) ? new Set(names) : null;
  save();
}
export const setSelQuery = (q: string) => { SELQ = q; };
/** Select one community or a whole region on or off. */
export function toggleCommunities(m: Model, names: string[], on: boolean): void {
  const cur = new Set(chosen(m));
  for (const n of names) if (on) cur.add(n); else cur.delete(n);
  setSel(m, [...cur]);
}
/** Dropdown actions: all, none, done, or region:<name> to show only that region. */
export function selectionAct(m: Model, arg: string): void {
  if (arg === 'all') setSel(m, null);
  else if (arg === 'none') setSel(m, []);
  else if (arg === 'done') OPEN.delete('fold:dsel');
  else if (arg.startsWith('region:')) {
    const rg = arg.slice(7), names = active(m).filter((c) => regionOfC(c) === rg).map((c) => c.name), cur = chosen(m);
    setSel(m, cur.length === names.length && names.every((n) => cur.includes(n)) ? null : names);
  }
}

/** The reader's selection, for the dashboard and its copied email. label is '' when everything is selected. */
export function regionFilter(m: Model): { inReg: (name: string) => boolean; region: string; where: string; regionOf: (name: string) => string } {
  const regionOf = (name: string) => regionOfC(m.settings.roster.find((c) => c.name === name) ?? {});
  const names = chosen(m), set = new Set(names), act = active(m);
  let label = '', where = '';
  if (SEL && names.length) {
    const rgs = [...new Set(act.map(regionOfC))].filter((rg) => { const r = act.filter((c) => regionOfC(c) === rg).map((c) => c.name); return r.every((n) => set.has(n)); });
    const covered = act.filter((c) => rgs.includes(regionOfC(c))).length;
    if (names.length === 1) { label = names[0]; where = `at ${names[0]}`; }
    else if (rgs.length && covered === names.length) {
      label = rgs.length === 1 ? `${rgs[0]} region` : rgs.length === 2 ? `${rgs[0]} and ${rgs[1]} regions` : `${rgs.length} regions`;
      where = `in the ${label}`.replace('in the ' + rgs.length + ' regions', `in ${rgs.length} regions`);
    } else { label = `${names.length} communities`; where = `at ${names.length} selected communities`; }
  }
  return { inReg: (name) => !SEL || set.has(name), region: label, where, regionOf };
}

function picker(m: Model, label: string): string {
  const act = active(m), names = new Set(chosen(m));
  const regions = [...new Set(act.map(regionOfC))].sort();
  const q = SELQ.toLowerCase();
  const score = (n: string) => m.communities.find((c) => c.c.name === n)?.score ?? null;
  return `<details class="dsel" data-fold="dsel"${OPEN.has('fold:dsel') ? ' open' : ''}>
    <summary><span class="lbl">Communities</span><b>${esc(label || `All communities (${act.length})`)}</b><span class="chev" aria-hidden="true"></span></summary>
    <div class="dselpanel">
      <div class="dselacts"><input type="search" id="dsel-q" placeholder="Find a community" value="${esc(SELQ)}" aria-label="Find a community"><button class="btn quiet sm" data-act="sel:all">Select all</button><button class="btn quiet sm" data-act="sel:none">Clear</button><button class="btn sm" data-act="sel:done">Done</button></div>
      <div class="dselgroups">${regions.map((rg) => {
        const cs = act.filter((c) => regionOfC(c) === rg), k = cs.filter((c) => names.has(c.name)).length;
        return `<fieldset><legend><label><input type="checkbox" data-selreg="${esc(rg)}"${k === cs.length ? ' checked' : ''}${k && k < cs.length ? ' data-ind="1"' : ''}><b>${esc(rg)}</b><small>${k}/${cs.length}</small></label></legend>
          ${cs.map((c) => `<label class="dselc"${q && !c.name.toLowerCase().includes(q) ? ' hidden' : ''}><input type="checkbox" data-sel="${esc(c.name)}"${names.has(c.name) ? ' checked' : ''}><span class="nm">${esc(c.name)}</span>${scorePill(score(c.name))}</label>`).join('')}</fieldset>`;
      }).join('')}</div>
    </div>
  </details>`;
}

/** EcoSure's Insects/Rodents/Animals section. 10.1.1 is pest activity seen at the visit, a critical finding. */
const isPest = (f: Finding) => f.section === 'Insects/Rodents/Animals' || f.cid.startsWith('10.');
const isActivity = (f: Finding) => f.cid === '10.1.1' || f.short === 'No critical pest activity';
const pestStatus = (f: Finding): [string, string] => f.capItem && f.audit.capState === 'closed' ? ['Remediated', 'good'] : f.capItem ? ['In progress', 'warn'] : ['No CAP yet', 'bad'];

function pestTracker(fs: Finding[], regionOf: (name: string) => string): string {
  const pests = fs.filter(isPest);
  const byComm = [...new Set(pests.map((f) => f.audit.community))].map((name) => {
    const list = pests.filter((f) => f.audit.community === name).sort((a, b) => Number(isActivity(b)) - Number(isActivity(a)));
    const open = list.filter((f) => pestStatus(f)[0] !== 'Remediated').length;
    return { name, slug: list[0].audit.slug, list, activity: list.some(isActivity), open, date: list.reduce((x, f) => (f.audit.date > x ? f.audit.date : x), '') };
  }).sort((a, b) => Number(b.activity) - Number(a.activity) || b.open - a.open || b.date.localeCompare(a.date));
  const act = byComm.filter((c) => c.activity).length;
  const { shown, more } = top('dash-pest', byComm, 5, 'communities');
  const label = (f: Finding) => (isActivity(f) ? 'Pest activity' : f.cid === '10.2.1' || /outer openings/i.test(f.short) ? 'Pest entry points not sealed' : f.cid === '10.1.2' || /insect control/i.test(f.short) ? 'Insect control devices' : 'Pest prevention');
  return `<section class="dpanel span12 dpest${act ? ' alert' : ''}"><header><div><h3>Pest tracker</h3><p>Pest activity is a critical finding and needs a pest control visit right away.</p></div><button class="linkbtn" data-act="section:Insects/Rodents/Animals">All pest findings</button></header>
    <div class="dpestsum"><span class="${act ? 'bad' : 'good'}"><b>${act}</b> ${act === 1 ? 'community' : 'communities'} with pest activity</span><span class="${byComm.length - act ? 'warn' : 'good'}"><b>${byComm.length - act}</b> with prevention gaps only</span></div>
    ${byComm.length ? `<div class="tablewrap"><table class="dpestt"><tbody>${shown.map((c) => `<tr class="rowlink${c.activity ? ' act' : ''}" data-go="c-${c.slug}">
      <td><b>${esc(c.name)}</b><span class="sub">${esc(regionOf(c.name))} · ${fmtDate(c.date)}</span></td>
      <td>${c.list.map((f) => { const [st, tone] = pestStatus(f); return `<div class="pf"><span class="chip ${isActivity(f) ? 't-bad' : 't-warn'}">${label(f)}</span>${f.audit.kitchen !== 'Main Kitchen' ? `<span class="xs">${esc(f.audit.kitchen)}</span>` : ''}<span class="chip t-${tone} plain">${st}</span>${f.comment ? `<span class="xs pc">${esc(f.comment.length > 110 ? f.comment.slice(0, 107) + '...' : f.comment)}</span>` : ''}</div>`; }).join('')}</td>
      <td class="pph">${(() => { const f = c.list.find((x) => x.photos.length); return f ? `<button class="ph" data-photo="${esc(f.key)}" data-n="0" aria-label="Open pest photo from ${esc(c.name)}"><img loading="lazy" src="${esc(photoUrl(f.photos[0]))}" alt=""></button>` : ''; })()}</td></tr>`).join('')}</tbody></table></div>${more}` : '<div class="okbox">No pest findings in the selected communities.</div>'}
  </section>`;
}

export function dashboard(m: Model, v: ViewState): string {
  const { inReg, regionOf, region: selLabel, where } = regionFilter(m);
  const regions = [...new Set(active(m).map(regionOfC))].sort();
  const all = latestPerKitchen(inRound(m, v));
  const A = all.filter((a) => inReg(a.community));
  const items = A.flatMap((a) => a.items);
  const sn = snapshot(m, v, inReg);
  const latestDate = m.audits.reduce((x, a) => (a.date > x ? a.date : x), '');

  // Communities of focus: the qualifying reasons from the latest quarterly audit, without status detail.
  const focusAll = communitiesOfFocus(m).filter(({ c }) => inReg(c.c.name)).sort((a, b) => (a.c.score ?? 101) - (b.c.score ?? 101));
  const focus = focusAll.slice(0, 5).map(({ c, why }) => ({ c, why: why.filter((w) => /critical|repeat/.test(w)) }));
  const regionRows = regions.filter((rg) => A.some((a) => regionOf(a.community) === rg)).map((rg) => ({ rg, s: avg(A.filter((a) => regionOf(a.community) === rg).map((a) => a.score)) }))
    .sort((x, y) => (x.s ?? 101) - (y.s ?? 101));

  const panel = (title: string, sub: string, go: string, body: string) => `<section class="dpanel span6"><header><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${go ? `<button class="linkbtn" data-go="${go}">Details</button>` : ''}</header>${body}</section>`;
  const sev = SEVS.map((x) => ({ x, n: items.filter((f) => f.criticality === x).length }));

  return `<div class="dash">
    <div class="dhead">
      <div><p class="crumb">Kisco Senior Living · Culinary food safety</p><h2 class="page">EcoSure Food Safety Dashboard</h2>
        <p class="note">Latest EcoSure audit of each kitchen · data through ${fmtDate(latestDate)}</p></div>
      <div class="pageacts"><button class="btn ghost sm" data-act="share">Copy link</button><button class="btn sm" data-act="copy-summary">Copy as email</button></div>
    </div>
    <div class="dfilters">${picker(m, selLabel)}<span class="grow"></span>${roundChips(m, v).replace('<div class="toolbar">', '<span class="dround">').replace(/<\/div>$/, '</span>')}</div>
    ${chosen(m).length ? '' : '<div class="okbox">No communities selected. Open the Communities list above and pick at least one.</div>'}

    <section class="dhero" aria-label="Quarter snapshot">
      <p class="dhl">This quarter EcoSure found <b>${sn.found} violations</b> across ${sn.kitchens} kitchens${where ? ` ${esc(where)}` : ''}. Our teams have remediated <b class="good">${sn.rate}%</b> of them.</p>
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

    <div class="dgrid">${pestTracker(items, regionOf)}</div>

    <div class="dgrid">
      ${panel('Communities of focus', `${focusAll.length > 5 ? `Lowest 5 of ${focusAll.length}` : 'From the latest quarterly audit'}: score below 70, 4+ critical or 3+ repeats`, 'communities', focus.length ? `<div class="tablewrap"><table class="dfocus"><tbody>${focus.map(({ c, why }) => `<tr class="rowlink" data-go="c-${c.slug}"><td><b>${esc(c.c.name)}</b><span class="sub">${esc([c.c.region ?? '', ...why].filter(Boolean).join(' · '))}</span></td><td class="num">${scorePill(c.score)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="okbox">None in this view.</div>')}
      ${panel('Average score by region', 'Select one to show only that region', '', `<div class="bars">${regionRows.map((x) => ` <button class="bar${selLabel === x.rg + ' region' ? ' on' : ''}" data-act="sel:region:${esc(x.rg)}"><span class="name">${esc(x.rg)}</span><span class="track"><span class="fill" style="width:${x.s ?? 0}%;background:${x.s == null ? 'var(--line)' : x.s >= 85 ? 'var(--good)' : x.s >= 70 ? 'var(--maj)' : 'var(--crit)'}"></span></span><span class="val">${pct(x.s)}</span></button>`).join('')}</div>`)}
    </div>

    ${fixCard(m, v, inReg)}
    ${stepsCard(m, v, inReg)}
  </div>`;
}
