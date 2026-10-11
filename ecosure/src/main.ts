import './styles.css';
import { learnStandard } from './catalog';
import { readFile, saveItem, type BackupFile, type QItem } from './importer';
import { DEFAULT_SETTINGS, buildModel, canonical, mergeRecords, scoreBand, type Finding, type Model } from './model';
import { fromLegacy, type LegacyBundle } from './parse/legacy';
import { connect, photoUrl, recId, setSeedPhotos, type Backend } from './store';
import type { Cap, Community, Rec, SelfAudit, SelfResult, Settings } from './types';
import { csv, esc, fmtDate, pct, slug, todayIso } from './util';
import { actions, communities, community, emptyFilters, filterFindings, findings, importView, settingsView, trends, type ViewState } from './views';
import { playbookView, prioritiesView, selfAuditForm, selfAuditsView, type SelfDraft } from './views-roles';
import { briefing, briefingText, talkingText } from './views-brief';
import { allStandards } from './catalog';
import { OPEN } from './expand';

/* ---------- state ---------- */
// Starting data from the previous review page; absent in a fresh clone (see README).
const seedFile = Object.values(import.meta.glob('./data/legacy-seed.json', { eager: true, import: 'default' }))[0];
const legacy = (seedFile ?? { audits: [], photos: {} }) as LegacyBundle;
setSeedPhotos(legacy.photos);
const seed: Rec[] = (() => {
  const { reports, caps } = fromLegacy(legacy, (n) => (legacy.photos[n] ? 'seed:' + n : null));
  const all: Rec[] = [...reports, ...caps];
  for (const r of all) { r.importedAt = '2026-10-10T00:00:00.000Z'; r.id = recId(r); }
  return all;
})();

let backend: Backend | null = null;
let stored: Rec[] = [];
let settings: Settings = DEFAULT_SETTINGS;
let model: Model = buildModel(seed, settings);
const queue: QItem[] = [];
const thumbs = new Map<string, string>();
const V: ViewState = { round: 'all', f: emptyFilters(), sort: { key: 'score', dir: 1 }, commFilter: '', actionTab: 'caps', canWrite: false, mode: 'starting', capEdit: null };
let route = 'home';

/* Per-viewer conveniences (self-audit drafts, the person's name) live in this browser only. */
const LS = {
  get(k: string): string | null { try { return localStorage.getItem('ecosure.' + k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem('ecosure.' + k, v); } catch { /* storage blocked */ } },
};
const PB = { theme: 'all', q: '', cited: false };
const drafts: Record<string, SelfDraft> = {};
function draftFor(s: string): SelfDraft {
  if (!drafts[s]) {
    let d: SelfDraft | null = null;
    try { d = JSON.parse(LS.get('draft.' + s) ?? 'null'); } catch { d = null; }
    const c = model.bySlug.get(s);
    drafts[s] = d ?? { kitchen: c?.c.kitchens[0] ?? 'Main Kitchen', date: todayIso(), by: LS.get('name') ?? '', results: {} };
  }
  return drafts[s];
}
const saveDraft = (s: string) => LS.set('draft.' + s, JSON.stringify(drafts[s]));
const SHARE_BASE: string = (import.meta.env.VITE_SHARE_URL as string | undefined) ?? '';
let routeArg: string | null = null;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

function rebuild(): void {
  model = buildModel(mergeRecords(seed, stored), settings, todayIso());
  for (const r of stored) if (r.kind === 'report' && !r.deleted) r.items.forEach(learnStandard);
}

/* ---------- routing ---------- */
const NAV: [string | null, [string, string][]][] = [
  [null, [['home', 'Briefing'], ['communities', 'Communities'], ['actions', 'Action list']]],
  ['More detail', [['priorities', 'Priorities'], ['findings', 'Findings and photos'], ['trends', 'Trends'], ['playbook', 'Readiness playbook'], ['self', 'Self-audits']]],
  ['Manage', [['import', 'Import files'], ['settings', 'Settings']]],
];
const MAIN = NAV.flatMap(([, xs]) => xs);

function go(to: string): void {
  if (location.hash.slice(1) !== to) location.hash = to;
  else render();
}
function readHash(): void {
  let h = decodeURIComponent(location.hash.slice(1)) || 'home';
  if (h === 'overview') h = 'home';
  if (h.startsWith('playbook.')) { route = 'playbook'; routeArg = h.slice(9); return; }
  if (h.startsWith('self-')) { route = h; routeArg = null; return; }
  if (h.startsWith('c-')) {
    const [s, d] = h.slice(2).split('.');
    if (route !== 'c-' + s) { V.f.crit = 'all'; V.f.kitchen = 'all'; }
    route = 'c-' + s; routeArg = d ?? null;
  } else { route = MAIN.some(([k]) => k === h) ? h : 'home'; routeArg = null; }
}

function navHtml(): string {
  const q = ($('#q') as HTMLInputElement | null)?.value.toLowerCase() ?? '';
  const na = model.communities.filter((c) => c.c.active && c.auditState !== 'done').length;
  const nc = model.communities.flatMap((c) => c.latest).filter((a) => !['closed', 'not-needed'].includes(a.capState)).length;
  const counts: Record<string, number> = { actions: na + nc };
  const list = model.communities.filter((c) => (c.c.active || c.audits.length) && (c.c.name + ' ' + c.c.city).toLowerCase().includes(q));
  const cur = route.startsWith('self-') ? 'self' : route;
  $('#navMain').innerHTML = NAV.map(([label, xs]) => (label ? `<div class="navlabel">${label}</div>` : '') + xs.map(([k, l]) => `<button data-go="${k}" aria-current="${cur === k}"><span>${l}</span>${counts[k] ? `<span class="count" title="${na} need an audit, ${nc} need CAP work">${counts[k]}</span>` : ''}</button>`).join('')).join('');
  $('#navComm').innerHTML = list.map((c) => {
    const flag = c.capState === 'late' || c.capState === 'overdue' ? 'bad' : c.capState === 'missing' || c.capState === 'open' ? 'warn' : '';
    return `<button data-go="c-${c.slug}" aria-current="${route === 'c-' + c.slug}"><span>${esc(c.c.name)}</span><span class="navr">${flag ? `<span class="flag ${flag}" title="CAP needs attention"></span>` : ''}<span class="pill s-${scoreBand(c.score)}">${pct(c.score)}</span></span></button>`;
  }).join('') || '<div class="note" style="color:#9DBAB5;padding:6px 10px">No match</div>';
  const m = $('#mode');
  m.className = 'mode ' + (V.mode === 'local' ? 'local' : '');
  m.innerHTML = V.mode === 'shared' ? '<i></i>Shared with everyone on this page' : V.mode === 'local' ? '<i></i>Saved in this browser only' : '<i></i>Connecting';
  return '';
}

function render(): void {
  readHash();
  navHtml();
  const main = $('#main');
  let html = '';
  if (route === 'home') {
    html = briefing(model, V);
  }
  else if (route === 'priorities') html = prioritiesView(model, V);
  else if (route === 'playbook') html = playbookView(model, routeArg, PB);
  else if (route === 'self') html = selfAuditsView(model);
  else if (route.startsWith('self-')) html = selfAuditForm(model, V, route.slice(5), draftFor(route.slice(5)));
  else if (route === 'actions') html = actions(model, V);
  else if (route === 'communities') html = communities(model, V);
  else if (route === 'findings') html = findings(model, V);
  else if (route === 'trends') html = trends(model, V);
  else if (route === 'import') html = importView(model, V, queue, stored, thumbs, mergeRecords(seed, stored));
  else if (route === 'settings') html = settingsView(model, V);
  else html = community(model, V, route.slice(2), routeArg);
  main.innerHTML = html;
  bindPage();
  if (route === 'playbook' && routeArg && !playbookScrolled) { playbookScrolled = true; document.getElementById('p-' + routeArg)?.scrollIntoView({ block: 'start' }); }
}
let playbookScrolled = false;

/** Re-render while keeping focus and caret in a text box the user is typing in. */
function rerender(): void {
  const a = document.activeElement as HTMLInputElement | null;
  const id = a?.id, pos = a?.selectionStart ?? null;
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
  if (id) { const el = document.getElementById(id) as HTMLInputElement | null; if (el) { el.focus(); if (pos != null && 'setSelectionRange' in el) try { el.setSelectionRange(pos, pos); } catch { /* not a text input */ } } }
}

function toast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 3600);
}

/* ---------- page bindings ---------- */
let qTimer = 0;
function bindPage(): void {
  const commq = document.getElementById('commq') as HTMLInputElement | null;
  commq?.addEventListener('input', () => { V.commFilter = commq.value; rerender(); });
  document.querySelectorAll<HTMLSelectElement>('select[data-filter]').forEach((s) => s.addEventListener('change', () => {
    (V.f as unknown as Record<string, string>)[s.dataset.filter!] = s.value; V.f.limit = 5; rerender();
  }));
  const fq = document.getElementById('f-q') as HTMLInputElement | null;
  fq?.addEventListener('input', () => { clearTimeout(qTimer); qTimer = window.setTimeout(() => { V.f.q = fq.value; V.f.limit = 5; rerender(); }, 200); });

  const drop = document.getElementById('drop');
  const file = document.getElementById('file') as HTMLInputElement | null;
  if (drop && file) {
    file.addEventListener('change', () => { if (file.files) void addFiles([...file.files]); file.value = ''; });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer?.files) void addFiles([...e.dataTransfer.files]); });
  }
  const pbq = document.getElementById('pb-q') as HTMLInputElement | null;
  pbq?.addEventListener('input', () => { clearTimeout(qTimer); qTimer = window.setTimeout(() => { PB.q = pbq.value; rerender(); }, 200); });
  if (route.startsWith('self-')) {
    const sl = route.slice(5), d = draftFor(sl);
    const bindVal = (id: string, k: 'kitchen' | 'date' | 'by') => { const el = document.getElementById(id) as HTMLInputElement | null; el?.addEventListener('input', () => { d[k] = el.value; saveDraft(sl); }); el?.addEventListener('change', () => { d[k] = el.value; saveDraft(sl); }); };
    bindVal('sa-kitchen', 'kitchen'); bindVal('sa-date', 'date'); bindVal('sa-by', 'by');
    document.querySelectorAll<HTMLInputElement>('input[data-note]').forEach((el) => el.addEventListener('input', () => {
      const r = d.results[el.dataset.note!]; if (r) { r.note = el.value; saveDraft(sl); }
    }));
    document.getElementById('selfform')?.addEventListener('submit', (e) => e.preventDefault());
  }
  const sf = document.getElementById('settings') as HTMLFormElement | null;
  sf?.addEventListener('submit', (e) => { e.preventDefault(); void saveSettings(readSettingsForm()); });
  document.querySelectorAll<HTMLFormElement>('form[data-capform]').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); void saveCapForm(f); }));
}

/* ---------- import ---------- */
async function addFiles(files: File[]): Promise<void> {
  for (const f of files) {
    const placeholder: QItem = { id: 'p' + Math.random(), name: f.name, status: 'reading', kind: 'unknown', recs: [], photos: new Map(), dataPhotos: {}, progress: 'Reading the file' };
    queue.unshift(placeholder);
  }
  rerender();
  for (const f of files) {
    const q = await readFile(f, settings);
    for (const [k, b] of q.photos) thumbs.set(k, URL.createObjectURL(b));
    const i = queue.findIndex((x) => x.status === 'reading' && x.name === f.name && x.id.startsWith('p'));
    if (i >= 0) queue[i] = q; else queue.unshift(q);
    rerender();
  }
}

async function saveQ(q: QItem): Promise<void> {
  if (!backend) return;
  q.status = 'saving'; rerender();
  try {
    if (q.settings) await saveSettings(q.settings, false);
    await saveItem(q, backend, (s) => { q.progress = s; rerender(); });
    const known = new Set(settings.roster.map((c) => c.name));
    const add = [...new Set(q.recs.map((r) => r.community))].filter((n) => !known.has(n));
    if (add.length) await saveSettings({ ...settings, roster: [...settings.roster, ...add.map((n) => newCommunity(n, q.recs))] }, false);
    q.status = 'saved';
  } catch (e) {
    q.status = 'error'; q.error = 'Could not save: ' + (e instanceof Error ? e.message : String(e));
  }
  rerender();
}

function newCommunity(name: string, recs: Rec[] = []): Community {
  const r = recs.find((x) => x.community === name);
  const ks = [...new Set(recs.filter((x) => x.community === name).map((x) => x.kitchen))].sort();
  return { name, short: name.replace(/^(The|Balfour)\s+/, ''), city: r?.kind === 'report' ? r.city : '', kitchens: ks.length ? ks : ['Main Kitchen'], active: true, note: '', aliases: [] };
}

/* ---------- settings ---------- */
function readSettingsForm(): Settings {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? '';
  const rounds = settings.rounds.map((_, i) => ({ name: val(`r-name-${i}`).trim(), start: val(`r-start-${i}`), end: val(`r-end-${i}`) })).filter((r) => r.name && r.start && r.end);
  const roster = settings.roster.map((c, i) => {
    const k = Math.max(1, parseInt(val(`c-k-${i}`)) || 1);
    return { ...c, name: val(`c-name-${i}`).trim() || c.name, short: val(`c-short-${i}`).trim(), city: val(`c-city-${i}`).trim(), region: val(`c-region-${i}`).trim(), note: val(`c-note-${i}`).trim(),
      aliases: val(`c-alias-${i}`).split(';').map((s) => s.trim()).filter(Boolean), active: (document.getElementById(`c-active-${i}`) as HTMLInputElement | null)?.checked ?? c.active,
      kitchens: k === 1 ? (c.kitchens.length === 1 ? c.kitchens : ['Main Kitchen']) : Array.from({ length: k }, (_, n) => `Kitchen ${n + 1}`) };
  });
  return { ...settings, rounds, roster, capDueDays: Math.max(1, parseInt(val('s-capDueDays')) || settings.capDueDays), cycleDays: Math.max(30, parseInt(val('s-cycleDays')) || settings.cycleDays) };
}

async function saveSettings(s: Settings, announce = true): Promise<void> {
  if (!backend) return;
  const next = { ...s, updatedAt: new Date().toISOString() };
  try {
    await backend.putSettings(next);
    settings = next; rebuild();
    if (announce) toast('Settings saved');
    rerender();
  } catch (e) { toast('Could not save settings: ' + (e instanceof Error ? e.message : String(e))); }
}

/* ---------- CAP status form ---------- */
async function saveCapForm(f: HTMLFormElement): Promise<void> {
  if (!backend) return;
  const a = model.audits.find((x) => x.key === f.dataset.capform);
  if (!a) return;
  const d = new FormData(f);
  const note = String(d.get('note') ?? '').trim(), owner = String(d.get('owner') ?? '').trim();
  const prev = a.cap;
  const items = a.items.map((i) => {
    const old = i.capItem;
    return { cid: i.cid, question: i.question, action: old?.action || note, update: old?.update ?? '', owner: owner || old?.owner || '', due: old?.due ?? '', touch: old?.touch ?? i.subsection, comment: old?.comment ?? '', subs: old?.subs ?? [], photos: old?.photos ?? [] };
  });
  const cap: Cap = {
    kind: 'cap', id: '', community: a.community, kitchen: a.kitchen, auditDate: a.date, status: String(d.get('status')), submitted: String(d.get('submitted') ?? ''),
    approved: String(d.get('approved') ?? ''), completed: prev?.completed ?? '', items: [...items, ...(prev ? a.capUnmatched : [])],
    file: prev ? prev.file + ' (status updated by hand)' : 'Entered by hand', fileRef: prev?.fileRef, source: 'manual', warnings: [], importedAt: new Date().toISOString(),
  };
  cap.id = prev?.id ?? recId(cap);
  try { await backend.put(cap); V.capEdit = null; toast('CAP status saved'); }
  catch (e) { toast('Could not save: ' + (e instanceof Error ? e.message : String(e))); }
}

/* ---------- exports ---------- */
async function download(name: string, data: string, mime: string): Promise<void> {
  try { await backend?.download(name, data, mime); } catch (e) { const c = (e as { code?: string })?.code; if (c && c !== 'declined' && c !== 'cancelled') toast('Download did not start: ' + ((e as Error).message ?? c)); }
}
const findingRows = (list: Finding[]) => csv([
  ['Community', 'Kitchen', 'City', 'Audit date', 'Round', 'Score', 'Client ID', 'Section', 'Standard', 'Criticality', 'Points', 'Repeat', 'Comment', 'Findings', 'CAP status', 'CAP action', 'CAP owner', 'CAP due'],
  ...list.map((i) => [i.audit.community, i.audit.kitchen, i.audit.city, i.audit.date, i.audit.round, i.audit.score, i.cid, i.section, i.short, i.criticality, i.points, i.repeat ? 'Yes' : '', i.comment, i.findings.join(' | '), i.audit.cap?.status ?? 'None', i.capItem?.action ?? '', i.capItem?.owner ?? '', i.capItem?.due ?? '']),
]);

async function backup(): Promise<void> {
  const photos: Record<string, string> = {};
  const recs = stored.filter((r) => !r.deleted);
  for (const ref of new Set(recs.flatMap((r) => (r.kind === 'self' ? [] : r.items.flatMap((i) => i.photos))))) {
    if (ref.startsWith('seed:')) continue;
    try {
      const b = await (await fetch(photoUrl(ref))).blob();
      photos[ref] = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(b); });
    } catch { /* keep the ref only */ }
  }
  const bk: BackupFile = { format: 'ecosure-review-backup', version: 1, exportedAt: new Date().toISOString(), settings, records: recs, photos };
  await download(`ecosure-backup-${todayIso()}.json`, JSON.stringify(bk), 'application/json');
}

/* ---------- lightbox ---------- */
let LB: { src: string; title: string; sub: string }[] = [];
let LBi = 0;
function openLB(key: string, n: number): void {
  const pool = route === 'findings' ? filterFindings(model, V) : model.findings.filter((f) => f.audit.slug === model.findings.find((x) => x.key === key)?.audit.slug);
  LB = pool.flatMap((f) => f.photos.map((p) => ({ src: photoUrl(p), title: f.short, sub: `${f.audit.community}, ${f.audit.kitchen} · ${fmtDate(f.audit.date)} · ${f.criticality}${f.comment ? ' · ' + f.comment : ''}`, key: f.key })))
    .map((x) => x);
  const f = model.findings.find((x) => x.key === key);
  LBi = Math.max(0, LB.findIndex((x) => x.src === photoUrl(f?.photos[n] ?? '')));
  showLB();
  $('#lb').hidden = false;
  $<HTMLButtonElement>('#lbClose').focus();
}
function showLB(): void {
  const x = LB[LBi];
  if (!x) return;
  $<HTMLImageElement>('#lbImg').src = x.src;
  $<HTMLImageElement>('#lbImg').alt = x.title;
  $('#lbCap').innerHTML = `<b>${esc(x.title)}</b>${esc(x.sub)}<div class="count">${LBi + 1} of ${LB.length}</div>`;
}
const closeLB = () => { $('#lb').hidden = true; };

/* ---------- clicks ---------- */
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const ph = t.closest<HTMLElement>('[data-photo]');
  if (ph) { openLB(ph.dataset.photo!, Number(ph.dataset.n)); return; }
  const rnd = t.closest<HTMLElement>('[data-round]');
  if (rnd) { V.round = rnd.dataset.round!; V.f.limit = 5; rerender(); return; }
  const tab = t.closest<HTMLElement>('[data-tab]');
  if (tab && !tab.dataset.go) { V.actionTab = tab.dataset.tab as ViewState['actionTab']; rerender(); return; }
  const au = t.closest<HTMLElement>('[data-audit]');
  if (au) { go(route + '.' + au.dataset.audit); return; }
  const cr = t.closest<HTMLElement>('[data-crit]');
  if (cr && !cr.dataset.go) { V.f.crit = cr.dataset.crit!; rerender(); return; }
  const kt = t.closest<HTMLElement>('[data-kitchen]');
  if (kt) { V.f.kitchen = kt.dataset.kitchen!; rerender(); return; }
  const tg = t.closest<HTMLElement>('[data-toggle]');
  if (tg) { const k = tg.dataset.toggle as 'repeat' | 'photos'; V.f[k] = !V.f[k]; rerender(); return; }
  const so = t.closest<HTMLElement>('th[data-sort]');
  if (so) { const k = so.dataset.sort!; V.sort = { key: k, dir: V.sort.key === k ? (V.sort.dir === 1 ? -1 : 1) : 1 }; rerender(); return; }
  const pt = t.closest<HTMLElement>('[data-pbtheme]');
  if (pt) { PB.theme = pt.dataset.pbtheme!; rerender(); return; }
  const sg = t.closest<HTMLElement>('[data-self]');
  if (sg && route.startsWith('self-')) {
    const sl = route.slice(5), d = draftFor(sl), k = sg.dataset.self!, r = sg.dataset.r as SelfResult;
    if (d.results[k]?.r === r) delete d.results[k]; else d.results[k] = { r, note: d.results[k]?.note };
    saveDraft(sl); rerender(); return;
  }
  const act = t.closest<HTMLElement>('[data-act]');
  if (act) { void doAct(act.dataset.act!); return; }
  const g = t.closest<HTMLElement>('[data-go]');
  if (g && !t.closest('a')) {
    if (g.dataset.tab) V.actionTab = g.dataset.tab as ViewState['actionTab'];
    if (g.dataset.go === 'findings' && g.dataset.crit) { V.f = { ...emptyFilters(), crit: g.dataset.crit }; }
    if (g.dataset.go === 'communities') V.f.community = g.dataset.band ? 'band:' + g.dataset.band : V.f.community.startsWith('band:') ? 'all' : V.f.community;
    $('#side').classList.remove('open');
    go(g.dataset.go!);
    window.scrollTo(0, 0);
  }
});

async function doAct(a: string): Promise<void> {
  const [k, ...rest] = a.split(':');
  const arg = rest.join(':');
  const toFindings = (patch: Partial<typeof V.f>) => { V.f = { ...emptyFilters(), ...patch }; if (route === 'findings') rerender(); else { go('findings'); window.scrollTo(0, 0); } };
  if (k === 'std') toFindings(route === 'findings' ? { ...V.f, std: arg, limit: 5 } : { std: arg });
  else if (k === 'crit') toFindings(route === 'findings' ? { ...V.f, crit: arg, limit: 5 } : { crit: arg });
  else if (k === 'section') toFindings(route === 'findings' ? { ...V.f, section: arg, limit: 5 } : { section: arg });
  else if (k === 'theme') toFindings({ theme: arg });
  else if (k === 'repeat') toFindings({ std: arg, repeat: true });
  else if (k === 'round') { V.round = arg; rerender(); }
  else if (k === 'clear-std') { V.f.std = ''; rerender(); }
  else if (k === 'share') copyText(shareUrl(), 'Link copied. Anyone you have shared the page with can open it.');
  else if (k === 'copy-summary') copyText(briefingText(model, V, SHARE_BASE || location.href.split('#')[0]), 'Briefing copied. Paste it into an email or Teams message.');
  else if (k === 'copy-community') copyText(communityText(arg), 'Summary copied. Paste it into an email or Teams message.');
  else if (k === 'scroll') document.getElementById(arg)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else if (k === 'expand') { if (OPEN.has(arg)) OPEN.delete(arg); else OPEN.add(arg); rerender(); }
  else if (k === 'std-photos') toFindings({ std: arg, photos: false });
  else if (k === 'pb-cited') { PB.cited = !PB.cited; rerender(); }
  else if (k === 'self-pass-rest' || k === 'self-reset' || k === 'self-submit') await selfAct(k);
  else if (k === 'clear-band') { V.f.community = 'all'; rerender(); }
  else if (k === 'clear-filters') { V.f = emptyFilters(); rerender(); }
  else if (k === 'more') { V.f.limit += 10; rerender(); }
  else if (k === 'cap-edit') { V.capEdit = arg || null; rerender(); }
  else if (k === 'save') { const q = queue.find((x) => x.id === arg); if (q) await saveQ(q); }
  else if (k === 'skip') { const q = queue.find((x) => x.id === arg); if (q) { q.status = 'skipped'; queue.splice(queue.indexOf(q), 1); rerender(); } }
  else if (k === 'save-all') { for (const q of queue.filter((x) => x.status === 'ready')) await saveQ(q); toast('Import finished'); }
  else if (k === 'clear-queue') { queue.splice(0, queue.length, ...queue.filter((q) => q.status === 'saving' || q.status === 'reading')); rerender(); }
  else if (k === 'del') {
    if (!backend) return;
    const btn = document.querySelector<HTMLElement>(`[data-act="${CSS.escape(a)}"]`);
    if (btn && btn.dataset.confirm !== '1') { btn.dataset.confirm = '1'; btn.textContent = 'Select again to remove'; return; }
    try { await backend.remove(arg); toast('Removed'); } catch (e) { toast('Could not remove: ' + (e as Error).message); }
  }
  else if (k === 'backup') await backup();
  else if (k === 'csv-findings') await download(`ecosure-findings-${todayIso()}.csv`, findingRows(filterFindings(model, V)), 'text/csv');
  else if (k === 'csv-findings-all') await download(`ecosure-findings-all-${todayIso()}.csv`, findingRows(model.findings), 'text/csv');
  else if (k === 'csv-actions') {
    const rows = V.actionTab === 'audits'
      ? [['Community', 'City', 'Status', 'Last audit', 'Days since', 'Last score', 'Note'], ...model.communities.filter((c) => c.c.active && c.auditState !== 'done').map((c) => [c.c.name, c.c.city, c.auditState, c.lastDate, c.daysSince, c.score == null ? '' : Math.round(c.score), c.c.note])]
      : [['Community', 'Kitchen', 'Audit date', 'Score', 'Findings', 'Critical', 'CAP state', 'EcoSure status', 'Submitted', 'CAP due'], ...model.communities.flatMap((c) => c.latest).filter((x) => !['closed', 'not-needed'].includes(x.capState)).map((x) => [x.community, x.kitchen, x.date, x.score, x.items.length, x.crit, x.capState, x.cap?.status ?? '', x.cap?.submitted ?? '', x.capDue])];
    await download(`ecosure-${V.actionTab === 'audits' ? 'audits-due' : 'caps'}-${todayIso()}.csv`, csv(rows), 'text/csv');
  }
  else if (k === 'csv-communities') await download(`ecosure-scorecard-${todayIso()}.csv`, csv([['Community', 'City', 'Kitchens', 'Last audit', 'Score', 'Previous', 'Findings', 'Critical', 'Repeats', 'Audit status', 'CAP status'],
    ...model.communities.map((c) => [c.c.name, c.c.city, c.latest.length, c.lastDate, c.score == null ? '' : Math.round(c.score), c.prevScore == null ? '' : Math.round(c.prevScore), c.openFindings, c.critLatest, c.repeats, c.auditState, c.capState])]), 'text/csv');
  else if (k === 'round-add') { const s = readSettingsForm(); const last = s.rounds[s.rounds.length - 1]; settings = { ...s, rounds: [...s.rounds, { name: 'New round', start: last ? last.end : todayIso(), end: last ? last.end : todayIso() }] }; rerender(); }
  else if (k === 'round-del') { const s = readSettingsForm(); s.rounds.splice(Number(arg), 1); settings = s; rerender(); }
  else if (k === 'roster-add') { const s = readSettingsForm(); settings = { ...s, roster: [...s.roster, newCommunity('New community')] }; rerender(); }
  else if (k === 'roster-add-unknown') { const s = readSettingsForm(); await saveSettings({ ...s, roster: [...s.roster, ...model.unknown.map((n) => newCommunity(n, mergeRecords(seed, stored)))] }); }
}

/* ---------- sharing ---------- */
function shareUrl(): string {
  const h = location.hash.slice(1);
  const base = SHARE_BASE || location.href.split('#')[0];
  return h ? `${base}#${h}` : base;
}

function copyText(text: string, done: string): void {
  const fallback = () => {
    const box = document.createElement('div');
    box.className = 'copybox'; box.setAttribute('role', 'dialog');
    box.innerHTML = `<div class="copyinner"><b>Copy this text</b><textarea id="copy-ta" readonly></textarea><button class="btn sm" id="copy-close">Done</button></div>`;
    document.body.append(box);
    const ta = box.querySelector('textarea')!; ta.value = text; ta.focus(); ta.select();
    box.querySelector('#copy-close')!.addEventListener('click', () => box.remove());
  };
  try { navigator.clipboard.writeText(text).then(() => toast(done), fallback); } catch { fallback(); }
}

function communityText(sl: string): string {
  const c = model.bySlug.get(sl);
  return c ? talkingText(c, `${SHARE_BASE || location.href.split('#')[0]}#c-${sl}`) : '';
}

async function selfAct(k: string): Promise<void> {
  const sl = route.slice(5), d = draftFor(sl);
  if (k === 'self-pass-rest') { for (const s of allStandards()) if (!d.results[s.short]) d.results[s.short] = { r: 'pass' }; saveDraft(sl); rerender(); return; }
  if (k === 'self-reset') { d.results = {}; saveDraft(sl); rerender(); return; }
  if (!backend) return;
  if (!d.by.trim()) { toast('Add your name in "Completed by" before submitting.'); document.getElementById('sa-by')?.focus(); return; }
  const c = model.bySlug.get(sl);
  if (!c) return;
  const rec: SelfAudit = { kind: 'self', id: '', community: c.c.name, kitchen: d.kitchen, date: d.date || todayIso(), by: d.by.trim(), results: d.results, importedAt: new Date().toISOString() };
  rec.id = recId(rec);
  try {
    await backend.put(rec);
    LS.set('name', rec.by);
    delete drafts[sl]; LS.set('draft.' + sl, 'null');
    toast('Self-audit saved');
    go('c-' + sl); window.scrollTo(0, 0);
  } catch (e) { toast('Could not save: ' + (e instanceof Error ? e.message : String(e))); }
}

/* ---------- shell ---------- */
function shell(): void {
  document.body.insertAdjacentHTML('afterbegin', `<div class="app">
  <aside class="side" id="side">
    <h1>EcoSure Audit Review</h1>
    <p class="sub">Kisco Senior Living culinary food safety</p>
    <p class="mode" id="mode"></p><br>
    <button class="menu-toggle" id="menuBtn" aria-expanded="false" aria-controls="side">Menu</button>
    <div class="navwrap">
      <nav class="nav" id="navMain" aria-label="Pages"></nav>
      <details class="navfold" id="commfold"><summary>All communities</summary>
        <input id="q" type="search" placeholder="Find a community" aria-label="Find a community">
        <nav class="nav" id="navComm" style="margin-top:6px" aria-label="Communities"></nav>
      </details>
    </div>
  </aside>
  <main id="main" tabindex="-1"></main>
</div>
<div class="lb" id="lb" hidden role="dialog" aria-modal="true" aria-label="Photo viewer">
  <button class="ctrl close" id="lbClose">Close</button>
  <button class="ctrl prev" id="lbPrev" aria-label="Previous photo">&#8249;</button>
  <figure><img id="lbImg" alt=""><figcaption id="lbCap"></figcaption></figure>
  <button class="ctrl next" id="lbNext" aria-label="Next photo">&#8250;</button>
</div>`);
  $('#q').addEventListener('input', navHtml);
  $('#menuBtn').addEventListener('click', () => { const s = $('#side'); s.classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', String(s.classList.contains('open'))); });
  $('#lbClose').addEventListener('click', closeLB);
  $('#lbPrev').addEventListener('click', () => { LBi = (LBi - 1 + LB.length) % LB.length; showLB(); });
  $('#lbNext').addEventListener('click', () => { LBi = (LBi + 1) % LB.length; showLB(); });
  $('#lb').addEventListener('click', (e) => { if ((e.target as HTMLElement).id === 'lb') closeLB(); });
  document.addEventListener('keydown', (e) => {
    if ($('#lb').hidden) return;
    if (e.key === 'Escape') closeLB();
    if (e.key === 'ArrowLeft') $('#lbPrev').click();
    if (e.key === 'ArrowRight') $('#lbNext').click();
  });
  // Remember which folded sections the reader opened, so re-renders keep them open.
  document.addEventListener('toggle', (e) => {
    const d = e.target as HTMLDetailsElement;
    if (!d.dataset?.fold) return;
    if (d.open) OPEN.add('fold:' + d.dataset.fold); else OPEN.delete('fold:' + d.dataset.fold);
  }, true);
  window.addEventListener('hashchange', () => { playbookScrolled = false; OPEN.clear(); render(); $('#main').focus({ preventScroll: true }); });
}

async function start(): Promise<void> {
  shell();
  render();
  backend = await connect();
  V.mode = backend.mode;
  V.canWrite = backend.canWrite;
  await backend.start((recs, s) => {
    stored = recs.map((r) => ({ ...r, community: canonical(r.community, (s ?? settings).roster) }));
    if (s) {
      // Saved rosters from before regions existed pick up the default region by name.
      const roster = s.roster.map((c) => ({ ...c, region: c.region ?? DEFAULT_SETTINGS.roster.find((d) => d.name === c.name)?.region ?? '' }));
      settings = { ...DEFAULT_SETTINGS, ...s, roster };
    }
    rebuild();
    rerender();
  });
  rerender();
}

void start();

// Expose for tests and debugging.
(window as unknown as { ecosure: unknown }).ecosure = { get model() { return model; }, slug };
