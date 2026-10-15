/**
 * Enterprise dashboard: the program's impact at a glance for the communities the reader picks.
 * Every number and panel links to the page with the detail behind it.
 */
import { type Audit, type Model } from './model';
import { esc, fmtDate } from './util';
import { inRound, latestPerKitchen, scorePill, type ViewState } from './views';
import { communitiesOfFocus, themeHeat } from './views-roles';
import { plainTitle } from './plain';
import { snapshot, type Challenge } from './views-brief';
import { OPEN, top } from './expand';
import { photoUrl } from './store';
import type { Finding } from './model';

import { bigBox, isActivity, isPest, isRemediated, pestLabel, pestStatus, shortOf } from './views-common';
import { CAUTIONS } from './cautions';

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
    if (names.length === 1) { label = shortOf(m, names[0]); where = `at ${label}`; }
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
          ${cs.map((c) => `<label class="dselc"${q && !(c.name + ' ' + (c.short ?? '')).toLowerCase().includes(q) ? ' hidden' : ''}><input type="checkbox" data-sel="${esc(c.name)}"${names.has(c.name) ? ' checked' : ''}><span class="nm" title="${esc(c.name)}">${esc(c.short || c.name)}</span>${scorePill(score(c.name))}</label>`).join('')}</fieldset>`;
      }).join('')}</div>
    </div>
  </details>`;
}

let PEST_TAB: 'activity' | 'prevention' = 'activity';
export const setPestTab = (t: string) => { PEST_TAB = t === 'prevention' ? 'prevention' : 'activity'; };

/** Pest findings, one row per community: a photo, what was identified and what was remediated. Expand a row for the detail. */
function pestTracker(m: Model, fs: Finding[]): string {
  const short = (name: string) => shortOf(m, name);
  const rows = (pick: (f: Finding) => boolean) => [...new Set(fs.filter((f) => isPest(f) && pick(f)).map((f) => f.audit.community))].map((name) => {
    const list = fs.filter((f) => isPest(f) && pick(f) && f.audit.community === name);
    return { name, slug: list[0].audit.slug, list, open: list.filter((f) => !isRemediated(f)).length };
  }).sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
  const act = rows(isActivity), prev = rows((f) => !isActivity(f));
  const cur = PEST_TAB === 'activity' ? act : prev;
  const t = top('dash-pest-' + PEST_TAB, cur, 5, 'communities');
  const join = (xs: string[]) => [...new Set(xs.filter(Boolean))].join(' ');
  // What to confirm with the team: the follow-up questions for the standards cited.
  const verify = (list: Finding[]) => [...new Set(list.flatMap((f) => CAUTIONS[f.short] ?? []))].slice(0, 3);
  const row = (r: (typeof cur)[number]) => {
    const found = join(r.list.map((f) => f.comment)) || join(r.list.map((f) => pestLabel(f)));
    const fixed = join(r.list.map((f) => f.capItem?.action ?? ''));
    const photos = r.list.flatMap((f) => f.photos.map((_, n) => ({ f, n })));
    const key = `pest-${r.slug}-${PEST_TAB}`;
    return `<details class="xrow prow ${PEST_TAB === 'activity' ? 'red' : 'yellow'}" data-fold="${key}"${OPEN.has('fold:' + key) ? ' open' : ''}><summary>
      ${photos[0] ? `<img src="${esc(photoUrl(photos[0].f.photos[0]))}" alt="" loading="lazy">` : '<span class="noimg"></span>'}
      <span class="xt"><b>${esc(short(r.name))}</b><span class="obs">${esc(found)}</span></span>${(() => { const [st, tone] = pestStatus(r.list); return `<span class="chip t-${tone} pst">${st}</span>`; })()}<span class="chev" aria-hidden="true"></span></summary>
      <div class="xbody">
        ${photos.length ? `<div class="thumbs">${photos.slice(0, 6).map(({ f, n }) => `<button data-photo="${esc(f.key)}" data-n="${n}" aria-label="Open pest photo from ${esc(short(r.name))}"><img loading="lazy" src="${esc(photoUrl(f.photos[n]))}" alt=""></button>`).join('')}</div>` : ''}
        <p><b>Remediated:</b> ${fixed ? esc(fixed) : 'No corrective action on file yet.'}</p>
        ${verify(r.list) ? `<div class="pverify"><b>Verify</b><ul>${verify(r.list).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        <div class="toolbar" style="margin:0"><button class="btn ghost sm" data-go="findings" data-section="Insects/Rodents/Animals" data-community="${esc(r.name)}">See these findings</button><button class="linkbtn" data-go="c-${r.slug}">Open ${esc(short(r.name))}</button></div>
      </div></details>`;
  };
  return `<section class="dpanel span12 dpest${act.length ? ' alert' : ''}"><header><div><h3>Pest Tracker</h3></div><button class="linkbtn" data-go="findings" data-section="Insects/Rodents/Animals">All pest findings</button></header>
    <div class="ptabs" role="tablist"><button class="ptab red" role="tab" data-act="pest:activity" aria-pressed="${PEST_TAB === 'activity'}"><b>${act.length}</b><span>Pest activity<small>${act.length === 1 ? 'community' : 'communities'}</small></span></button><button class="ptab yellow" role="tab" data-act="pest:prevention" aria-pressed="${PEST_TAB === 'prevention'}"><b>${prev.length}</b><span>Prevention gaps<small>${prev.length === 1 ? 'community' : 'communities'} · fix to keep pests out</small></span></button></div>
    ${cur.length ? `<div class="xlist">${t.shown.map(row).join('')}</div>${t.more}` : `<div class="okbox">${PEST_TAB === 'activity' ? 'No pest activity found in the selected communities.' : 'No pest prevention gaps in the selected communities.'}</div>`}
  </section>`;
}

/** The top 3 challenges: the trend and next quarter's Culinary Director (CD) focus, with the detail one click away. */
function challenges(m: Model, top: Challenge[], total: number): string {
  if (!top.length) return '';
  const sec = (label: string, body: string) => (body ? `<div class="chsec"><span class="dl">${label}</span>${body}</div>` : '');
  const list = (xs: string[]) => (xs.length ? `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  return `<section class="chal" aria-label="Top Three Challenges"><header><h3>Top Three Challenges</h3></header>
    <div class="challist">${top.map((t, i) => {
      const key = 'chal-' + i;
      return `<details class="chalrow" data-fold="${key}"${OPEN.has('fold:' + key) ? ' open' : ''}><summary>
        <span class="rank">${i + 1}</span>
        <div class="cbody">
          <div class="ct"><b>${esc(t.title)}</b><span class="chip c-${t.crit}">${t.crit}</span></div>
          <p><span class="cl">Trend</span><span><b class="tpct">${t.share}% of communities</b>${t.mostly.length ? `, mainly ${esc(t.mostly.map((x) => x.label).join(' and '))}` : ''}</span></p>
          <p><span class="cl cd">Next quarter CD focus</span><span>${esc(t.focus)}</span></p>
        </div>
        <span class="cn"><b>${t.n}</b>${t.n === 1 ? 'issue' : 'issues'}</span>
        <span class="chev" aria-hidden="true"></span></summary>
      <div class="chalbody">
        <div>
          ${sec('How widespread', `<ul class="chdid"><li><span>Communities</span><b>${t.comms} of ${t.commsTotal}</b></li><li><span>Kitchens</span><b>${t.kitchens} of ${total}</b></li>${t.mostly.map((x) => `<li><span>${esc(x.label.charAt(0).toUpperCase() + x.label.slice(1))}</span><b>${x.k} ${x.k === 1 ? 'kitchen' : 'kitchens'}</b></li>`).join('')}${t.region ? `<li><span>Most in ${esc(t.region.name)}</span><b>${t.region.k} ${t.region.k === 1 ? 'issue' : 'issues'}</b></li>` : ''}</ul>`)}
          ${sec('Why it matters', t.why ? `<p>${esc(t.why)}</p>` : '')}
          ${sec('What teams did', t.themes.length ? `<ul class="chdid">${t.themes.map((x) => `<li><span>${esc(x.label.charAt(0).toUpperCase() + x.label.slice(1))}</span><b>${x.k} ${x.k === 1 ? 'kitchen' : 'kitchens'}</b></li>`).join('')}</ul>${t.example ? `<blockquote>“${esc(t.example.text)}”<cite>${esc(shortOf(m, t.example.who))}</cite></blockquote>` : ''}` : '')}
        </div>
        <div class="chsec caution">
          ${sec('What the CD should check', list(t.cautions))}
          ${sec('What to have in place', list(t.have))}
        </div>
        <button class="btn ghost sm" data-act="std-photos:${esc(t.short)}">See all ${t.n} findings</button>
      </div></details>`;
    }).join('')}</div></section>`;
}

/** The four numbers at the top: issues found, resolved, open high-risk (critical), and days from audit to a plan on file (target 10). */
function headline(m: Model, A: Audit[]): { tiles: string; line: string; mitNote: string } {
  const items = A.flatMap((a) => a.items);
  const done = items.filter(isRemediated).length;
  const rate = items.length ? Math.round((done / items.length) * 100) : 0;
  const n = (x: string) => items.filter((f) => f.criticality === x).length;
  // High-risk = EcoSure's critical findings. Open ones are either untouched (red) or made safe on site with the full fix in progress (yellow).
  const crit = items.filter((f) => f.criticality === 'Critical');
  const critDone = crit.filter(isRemediated).length;
  const open = crit.filter((f) => !isRemediated(f));
  const mit = open.filter((f) => f.mitigated), raw = open.filter((f) => !f.mitigated);
  const codes = (fs: Finding[]) => [...new Set(fs.map((f) => f.audit.community))].length;
  const days = A.filter((a) => a.items.length && a.cap && (a.cap.submitted || a.cap.approved)).map((a) => Math.round((Date.parse(a.cap!.submitted || a.cap!.approved) - Date.parse(a.date)) / 864e5)).filter((d) => !Number.isNaN(d)).sort((x, y) => x - y);
  const med = days.length ? (days.length % 2 ? days[(days.length - 1) / 2] : Math.round((days[days.length / 2 - 1] + days[days.length / 2]) / 2)) : null;
  // Remediated = resolved on a plan, or made safe on site with the full solution still to come.
  const critRem = critDone + mit.length;
  const tiles = `<div class="dbig dfour">
    ${bigBox('Issues found', String(items.length), { go: 'findings', sub: `<span class="sv c">${n('Critical')} critical</span> <span class="sv j">${n('Major')} major</span> <span class="sv n">${n('Minor')} minor</span>` })}
    ${bigBox('Resolved', rate + '%', { tone: 'good', go: 'findings', cap: 'closed', meter: rate, sub: `${done} of ${items.length}` })}
    <button class="${raw.length ? 'bad' : 'good'} hrtile" data-act="expand:hr" aria-expanded="${OPEN.has('hr')}"><span class="dl">High-risk issues identified and remediated</span><b>${critRem}/${crit.length}</b><span class="ds">${mit.length ? `<span class="mitg">${mit.length} waiting for a full solution</span>` : 'all fully resolved'}${raw.length ? `<span class="rawg">${raw.length} still open at ${codes(raw)} ${codes(raw) === 1 ? 'community' : 'communities'}</span>` : ''}<span class="more">${OPEN.has('hr') ? 'Hide detail ▴' : 'Show detail ▾'}</span></span></button>
    ${bigBox('Days to a plan on file', med == null ? '–' : String(med), { tone: med != null && med <= 10 ? 'good' : 'warn', sub: 'median · target 10 or fewer' })}
  </div>`;
  // One line: what was found, over which audit window, and the result.
  const ds = A.map((a) => a.date).sort(), d0 = ds[0] ?? '', d1 = ds[ds.length - 1] ?? '';
  const window = d0 && d1 ? Math.round((Date.parse(d1) - Date.parse(d0)) / 86400000) + 1 : 0;
  const line = `${window > 1 ? `In ${window} days, ` : ''}${A.length} audits conducted, ${done} out of ${items.length} issues remediated and logged.`;
  // The auditor's own note confirms each one was made safe on site.
  const mitNote = !OPEN.has('hr') ? '' : `<div class="dmit"><span class="dl">${critDone} of ${crit.length} resolved on a filed action plan${mit.length ? ` · ${mit.length} waiting for a full solution, immediate risk remediated on site` : ''}</span>${mit.length ? `<ul>${mit.map((f) => `<li><button class="linkbtn strong" data-go="c-${f.audit.slug}">${esc(shortOf(m, f.audit.community))}</button> <b>${esc(plainTitle(f.short))}.</b> <span class="aud">Auditor's note: “${esc(f.comment)}”</span></li>`).join('')}</ul>` : ''}${raw.length ? `<p class="rawg">${raw.length} still open with no plan: ${esc([...new Set(raw.map((f) => shortOf(m, f.audit.community)))].join(', '))}.</p>` : ''}<button class="btn ghost sm" data-go="findings" data-crit="Critical">See all ${crit.length} high-risk findings</button></div>`;
  return { tiles, line, mitNote };
}

/** Round picker: every planned round, with the ones not yet audited marked. */
function roundSelect(m: Model, v: ViewState): string {
  const used = new Set(m.audits.map((a) => a.round));
  const names = [...m.settings.rounds.map((r) => r.name), ...[...used].filter((n) => !m.settings.rounds.some((r) => r.name === n)).sort()];
  return `<label class="dround"><span class="lbl">Round</span><select data-dround aria-label="Audit round"><option value="all"${v.round === 'all' ? ' selected' : ''}>All rounds</option>${names.map((n) => `<option value="${esc(n)}"${v.round === n ? ' selected' : ''}>${esc(n)}${used.has(n) ? '' : ' (upcoming)'}</option>`).join('')}</select></label>`;
}

export function dashboard(m: Model, v: ViewState): string {
  const { inReg, region: selLabel } = regionFilter(m);
  const all = latestPerKitchen(inRound(m, v));
  const A = all.filter((a) => inReg(a.community));
  const items = A.flatMap((a) => a.items);
  const sn = snapshot(m, v, inReg);
  const hl = headline(m, A);

  // Communities of focus: the qualifying reasons from the latest quarterly audit, without status detail.
  const focusAll = communitiesOfFocus(m).filter(({ c }) => inReg(c.c.name)).sort((a, b) => (a.c.score ?? 101) - (b.c.score ?? 101));
  const focusT = top('dash-focus', focusAll, 5, 'communities');

  const panel = (title: string, sub: string, go: string, body: string) => `<section class="dpanel span12"><header><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${go ? `<button class="linkbtn" data-go="${go}">Details</button>` : ''}</header>${body}</section>`;

  const html = `<div class="dash">
    <div class="dhead">
      <span aria-hidden="true"></span><h2 class="page">EcoSure Food Safety Dashboard</h2>
      <div class="pageacts"><button class="btn ghost sm" data-act="share">Copy link</button><button class="btn sm" data-act="copy-summary">Copy as email</button></div>
    </div>
    <div class="dfilters">${picker(m, selLabel)}<span class="grow"></span>${roundSelect(m, v)}</div>
    ${chosen(m).length ? '' : '<div class="okbox">No communities selected. Open the Communities list above and pick at least one.</div>'}
    ${all.length ? '' : `<div class="dfuture"><b>${esc(v.round)}: no EcoSure audits yet</b><p>${(() => { const r = m.settings.rounds.find((x) => x.name === v.round); return r ? `This round runs ${fmtDate(r.start)} to ${fmtDate(r.end)}. ` : ''; })()}Results will appear here as audits come in. Pick another round to see past results.</p><button class="btn sm" data-round="all">Show all rounds</button></div></div>`}

    ${all.length ? '' : '<!--end-->'}<section class="dwin" aria-label="Quarter snapshot"><p class="dhl">${hl.line}</p></section>
    <section class="dhero" aria-label="Quarter numbers">
      ${hl.tiles}
      ${hl.mitNote}
    </section>

    ${challenges(m, sn.top, sn.kitchens)}

    <div class="dgrid">${pestTracker(m, items)}</div>

    <div class="dgrid">
      ${panel('Communities of Focus', `${focusAll.length > 5 ? `Lowest 5 of ${focusAll.length}` : 'From the latest quarterly audit'}: score below 70, 4+ high-risk issues or 3+ repeats. Points lost by area, darker is worse; select a community to open it.`, '', focusAll.length ? themeHeat(m, A, focusT.shown.map(({ c }) => c.c.name)) + focusT.more : '<div class="okbox">None in this view.</div>')}
    </div>

  </div>`;
  // A round with no audits yet: stop after the notice.
  return all.length ? html : html.slice(0, html.indexOf('<!--end-->'));
}
