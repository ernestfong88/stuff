/**
 * Enterprise dashboard: the program's impact at a glance for the communities the reader picks.
 * Every number and panel links to the page with the detail behind it.
 */
import { type Model } from './model';
import { esc, fmtDate } from './util';
import { inRound, latestPerKitchen, roundChips, scorePill, type ViewState } from './views';
import { communitiesOfFocus } from './views-roles';
import { fixCard, snapshot, type Challenge } from './views-brief';
import { OPEN, top } from './expand';
import { photoUrl } from './store';
import type { Finding } from './model';

import { bigBox, critMix, isActivity, isPest, isRemediated, pestLabel, statusChip } from './views-common';

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

let PEST_TAB: 'activity' | 'prevention' = 'activity';
export const setPestTab = (t: string) => { PEST_TAB = t === 'prevention' ? 'prevention' : 'activity'; };

/** Pest findings, one row per community: a photo, what was identified and what was remediated. Expand a row for the detail. */
function pestTracker(m: Model, fs: Finding[]): string {
  const short = (name: string) => m.settings.roster.find((c) => c.name === name)?.short || name;
  const rows = (pick: (f: Finding) => boolean) => [...new Set(fs.filter((f) => isPest(f) && pick(f)).map((f) => f.audit.community))].map((name) => {
    const list = fs.filter((f) => isPest(f) && pick(f) && f.audit.community === name);
    return { name, slug: list[0].audit.slug, list, open: list.filter((f) => !isRemediated(f)).length };
  }).sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
  const act = rows(isActivity), prev = rows((f) => !isActivity(f));
  const cur = PEST_TAB === 'activity' ? act : prev;
  const t = top('dash-pest-' + PEST_TAB, cur, 5, 'communities');
  const join = (xs: string[]) => [...new Set(xs.filter(Boolean))].join(' ');
  const row = (r: (typeof cur)[number]) => {
    const found = join(r.list.map((f) => f.comment)) || join(r.list.map((f) => pestLabel(f)));
    const fixed = join(r.list.map((f) => f.capItem?.action ?? ''));
    const photos = r.list.flatMap((f) => f.photos.map((_, n) => ({ f, n })));
    const key = `pest-${r.slug}-${PEST_TAB}`;
    const clip = (x: string, n: number) => (x.length > n ? x.slice(0, n - 3) + '...' : x);
    return `<details class="xrow prow ${PEST_TAB === 'activity' ? 'red' : 'yellow'}" data-fold="${key}"${OPEN.has('fold:' + key) ? ' open' : ''}><summary>
      ${photos[0] ? `<img src="${esc(photoUrl(photos[0].f.photos[0]))}" alt="" loading="lazy">` : '<span class="noimg"></span>'}
      <span class="xt"><b>${esc(short(r.name))}</b><span class="xs">${esc(clip(found, 120))}</span></span>${statusChip(r.list)}<span class="chev" aria-hidden="true"></span></summary>
      <div class="xbody">
        ${photos.length ? `<div class="thumbs">${photos.slice(0, 6).map(({ f, n }) => `<button data-photo="${esc(f.key)}" data-n="${n}" aria-label="Open pest photo from ${esc(short(r.name))}"><img loading="lazy" src="${esc(photoUrl(f.photos[n]))}" alt=""></button>`).join('')}</div>` : ''}
        <p><b>Identified:</b> ${esc(found)}</p>
        <p><b>Remediated:</b> ${fixed ? esc(fixed) : 'No corrective action on file yet.'}</p>
        <div class="toolbar" style="margin:0"><button class="btn ghost sm" data-go="findings" data-section="Insects/Rodents/Animals" data-community="${esc(r.name)}">See these findings</button><button class="linkbtn" data-go="c-${r.slug}">Open ${esc(short(r.name))}</button></div>
      </div></details>`;
  };
  return `<section class="dpanel span12 dpest${act.length ? ' alert' : ''}"><header><div><h3>Pest tracker</h3><p>Pest activity is a critical finding and needs a pest control visit right away.</p></div><button class="linkbtn" data-go="findings" data-section="Insects/Rodents/Animals">All pest findings</button></header>
    <div class="ptabs" role="tablist"><button class="ptab red" role="tab" data-act="pest:activity" aria-pressed="${PEST_TAB === 'activity'}"><b>${act.length}</b><span>Pest activity<small>${act.length === 1 ? 'community' : 'communities'} · act now</small></span></button><button class="ptab yellow" role="tab" data-act="pest:prevention" aria-pressed="${PEST_TAB === 'prevention'}"><b>${prev.length}</b><span>Prevention gaps<small>${prev.length === 1 ? 'community' : 'communities'} · fix to keep pests out</small></span></button></div>
    ${cur.length ? `<div class="xlist">${t.shown.map(row).join('')}</div>${t.more}` : `<div class="okbox">${PEST_TAB === 'activity' ? 'No pest activity found in the selected communities.' : 'No pest prevention gaps in the selected communities.'}</div>`}
  </section>`;
}

/** The top 3 challenges: the violation count up front; open one for what teams did and what our SMEs will focus on. */
function challenges(top: Challenge[]): string {
  if (!top.length) return '';
  return `<section class="chal" aria-label="Top 3 challenges"><header><h3>Top 3 challenges</h3><p>Ranked by impact on the score. Open one for what teams did and what our SMEs will focus on.</p></header>
    <div class="challist">${top.map((t, i) => {
      const key = 'chal-' + i;
      return `<details class="chalrow" data-fold="${key}"${OPEN.has('fold:' + key) ? ' open' : ''}><summary>
        <span class="rank">${i + 1}</span>
        <span class="ct"><b>${esc(t.title)}</b><span class="chip c-${t.crit}">${t.crit}</span></span>
        <span class="cn"><b>${t.n}</b> ${t.n === 1 ? 'violation' : 'violations'}<small>in ${t.kitchens} ${t.kitchens === 1 ? 'kitchen' : 'kitchens'}</small></span>
        <span class="chev" aria-hidden="true"></span></summary>
      <div class="chalbody">
        <div class="chsec">${t.why ? `<span class="dl">Why it matters</span><p class="chwhy">${esc(t.why)}</p>` : ''}
          <span class="dl">What teams did</span>${t.themes.length ? `<ul class="chdid">${t.themes.map((x) => `<li><span>${esc(x.label.charAt(0).toUpperCase() + x.label.slice(1))}</span><b>${x.k} ${x.k === 1 ? 'kitchen' : 'kitchens'}</b></li>`).join('')}</ul>` : '<p class="xs">Corrective plans in progress.</p>'}
          ${t.example ? `<blockquote>“${esc(t.example.text)}”<cite>${esc(t.example.who)}</cite></blockquote>` : ''}</div>
        ${t.cautions.length ? `<div class="chsec caution"><span class="dl">Our SMEs will focus on these with teams</span><ul>${t.cautions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
        <button class="linkbtn" data-act="std-photos:${esc(t.short)}">See all ${t.n} findings</button>
      </div></details>`;
    }).join('')}</div></section>`;
}

export function dashboard(m: Model, v: ViewState): string {
  const { inReg, region: selLabel, where } = regionFilter(m);
  const all = latestPerKitchen(inRound(m, v));
  const A = all.filter((a) => inReg(a.community));
  const items = A.flatMap((a) => a.items);
  const sn = snapshot(m, v, inReg);
  const latestDate = m.audits.reduce((x, a) => (a.date > x ? a.date : x), '');

  // Communities of focus: the qualifying reasons from the latest quarterly audit, without status detail.
  const focusAll = communitiesOfFocus(m).filter(({ c }) => inReg(c.c.name)).sort((a, b) => (a.c.score ?? 101) - (b.c.score ?? 101));
  const focus = focusAll.slice(0, 5).map(({ c, why }) => ({ c, why: why.filter((w) => /critical|repeat/.test(w)) }));

  const panel = (title: string, sub: string, go: string, body: string) => `<section class="dpanel span12"><header><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${go ? `<button class="linkbtn" data-go="${go}">Details</button>` : ''}</header>${body}</section>`;

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
        ${bigBox('Violations identified', String(sn.found), { go: 'findings' })}
        ${bigBox('Remediated', String(sn.done), { tone: 'good', go: 'findings', cap: 'closed' })}
        ${bigBox('Remediation rate', sn.rate + '%', { tone: 'good', meter: sn.rate })}
      </div>
      ${critMix(items)}
    </section>

    ${challenges(sn.top)}

    <div class="dgrid">${pestTracker(m, items)}</div>

    <div class="dgrid">
      ${panel('Communities of focus', `${focusAll.length > 5 ? `Lowest 5 of ${focusAll.length}` : 'From the latest quarterly audit'}: score below 70, 4+ critical or 3+ repeats`, '', focus.length ? `<div class="tablewrap"><table class="dfocus"><tbody>${focus.map(({ c, why }) => `<tr class="rowlink" data-go="c-${c.slug}"><td><b>${esc(c.c.name)}</b><span class="sub">${esc([c.c.region ?? '', ...why].filter(Boolean).join(' · '))}</span></td><td class="num">${scorePill(c.score)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="okbox">None in this view.</div>')}
    </div>

    ${fixCard(m, v, inReg)}
  </div>`;
}
