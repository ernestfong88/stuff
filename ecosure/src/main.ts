import './styles.css';
import { learnStandard } from './catalog';
import { readFile, saveItem, type BackupFile, type QItem } from './importer';
import { DEFAULT_SETTINGS, buildModel, canonical, capMissing, mergeRecords, scoreBand, type Finding, type Model } from './model';
import { fromLegacy, type LegacyBundle } from './parse/legacy';
import { connect, photoUrl, recId, setSeedPhotos, type Backend } from './store';
import type { Cap, Community, Rec, Settings } from './types';
import { csv, esc, fmtDate, pct, slug, todayIso } from './util';
import { community, emptyFilters, filterFindings, findings, importView, settingsView, trends, type ViewState } from './views';
import { playbookView, prioritiesView } from './views-roles';
import { briefingText, talkingText } from './views-brief';
import { shortOf } from './views-common';
import { dashboard, regionFilter, selectionAct, setPestTab, setSelQuery, toggleCommunities } from './views-dash';
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
const V: ViewState = { round: 'all', f: emptyFilters(), canWrite: false, mode: 'starting', capEdit: null };
let route = 'dashboard';

const PB = { theme: 'all', q: '', cited: false };
const SHARE_BASE: string = (import.meta.env.VITE_SHARE_URL as string | undefined) ?? '';
let routeArg: string | null = null;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

function rebuild(): void {
  model = buildModel(mergeRecords(seed, stored), settings, todayIso());
  for (const r of stored) if (r.kind === 'report' && !r.deleted) r.items.forEach(learnStandard);
}

/* ---------- routing ---------- */
// The dashboard comes first, then the community list (in the shell), then reference pages.
const NAV: [string | null, [string, string][]][] = [
  [null, [['dashboard', 'Executive dashboard']]],
  ['More detail', [['priorities', 'Priorities'], ['findings', 'Findings and photos'], ['trends', 'Trends'], ['playbook', 'Readiness playbook']]],
  ['Manage', [['import', 'Import files'], ['settings', 'Settings']]],
];
const MAIN = NAV.flatMap(([, xs]) => xs);

function go(to: string): void {
  if (location.hash.slice(1) !== to) location.hash = to;
  else render();
}
function readHash(): void {
  let h = decodeURIComponent(location.hash.slice(1)) || 'dashboard';
  if (h === 'overview' || h === 'home') h = 'dashboard'; // the briefing now lives on the dashboard
  if (h.startsWith('playbook.')) { route = 'playbook'; routeArg = h.slice(9); return; }
  if (h.startsWith('c-')) {
    const [s, d] = h.slice(2).split('.');
    if (route !== 'c-' + s) { V.f.crit = 'all'; V.f.kitchen = 'all'; }
    route = 'c-' + s; routeArg = d ?? null;
  } else { route = MAIN.some(([k]) => k === h) ? h : 'dashboard'; routeArg = null; }
}

function navHtml(): string {
  const q = ($('#q') as HTMLInputElement | null)?.value.toLowerCase() ?? '';
  const list = model.communities.filter((c) => (c.c.active || c.audits.length) && (c.c.name + ' ' + (c.c.short ?? '') + ' ' + c.c.city).toLowerCase().includes(q)).sort((a, b) => (a.c.short || a.c.name).localeCompare(b.c.short || b.c.name));
  // Viewers never see the editing pages; editors (and local copies) do.
  const group = ([label, xs]: [string | null, [string, string][]]) => (label ? `<div class="navlabel">${label}</div>` : '') + xs.map(([k, l]) => `<button data-go="${k}" aria-current="${route === k}"><span>${l}</span></button>`).join('');
  $('#navMain').innerHTML = group(NAV[0]);
  // More detail and Manage are folded; a fold opens on its own when the current page is inside it.
  const fill = (fold: string, nav: string, i: number) => {
    $(nav).innerHTML = group([null, NAV[i][1]]);
    const d = $(fold) as HTMLDetailsElement;
    if (NAV[i][1].some(([k]) => k === route)) d.open = true;
  };
  fill('#morefold', '#navMore', 1);
  fill('#managefold', '#navManage', 2);
  $('#managefold').hidden = !V.canWrite;
  $('#navComm').innerHTML = list.map((c) => {
    const miss = c.latest.some(capMissing);
    const flag = c.capState === 'overdue' || c.capState === 'open' ? 'warn' : '';
    return `<button data-go="c-${c.slug}" aria-current="${route === 'c-' + c.slug}"><span title="${esc(c.c.name)}">${esc(c.c.short || c.c.name)}</span><span class="navr">${miss ? '<span class="captag" title="No corrective action plan filed">CAP needed</span>' : flag ? `<span class="flag ${flag}" title="Action plan filed, not yet approved by EcoSure"></span>` : ''}<span class="pill s-${scoreBand(c.score)}">${pct(c.score)}</span></span></button>`;
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
  if (route === 'dashboard') html = dashboard(model, V);
  else if (route === 'priorities') html = prioritiesView(model, V);
  else if (route === 'playbook') html = playbookView(model, routeArg, PB);
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
  document.querySelectorAll<HTMLSelectElement>('select[data-filter]').forEach((s) => s.addEventListener('change', () => {
    (V.f as unknown as Record<string, string>)[s.dataset.filter!] = s.value; V.f.limit = 5; rerender();
  }));
  const fq = document.getElementById('f-q') as HTMLInputElement | null;
  fq?.addEventListener('input', () => { clearTimeout(qTimer); qTimer = window.setTimeout(() => { V.f.q = fq.value; V.f.limit = 5; rerender(); }, 200); });

  // Dashboard community picker: a community or a whole region on or off; the search box only hides rows.
  document.querySelectorAll<HTMLInputElement>('input[data-sel]').forEach((el) => el.addEventListener('change', () => { toggleCommunities(model, [el.dataset.sel!], el.checked); rerender(); }));
  document.querySelectorAll<HTMLInputElement>('input[data-selreg]').forEach((el) => {
    if (el.dataset.ind) el.indeterminate = true;
    el.addEventListener('change', () => {
      const names = settings.roster.filter((c) => c.active && (c.region || 'No region set') === el.dataset.selreg).map((c) => c.name);
      toggleCommunities(model, names, el.checked); rerender();
    });
  });
  const dq = document.getElementById('dsel-q') as HTMLInputElement | null;
  dq?.addEventListener('input', () => {
    setSelQuery(dq.value);
    const q = dq.value.toLowerCase();
    document.querySelectorAll<HTMLLabelElement>('.dselc').forEach((l) => { l.hidden = !!q && !(l.textContent! + ' ' + (l.querySelector('.nm')?.getAttribute('title') ?? '')).toLowerCase().includes(q); });
  });

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
  LB = pool.flatMap((f) => f.photos.map((p) => ({ src: photoUrl(p), title: f.short,  sub: `${shortOf(model, f.audit.community)}, ${f.audit.kitchen} · ${fmtDate(f.audit.date)} · ${f.criticality}${f.comment ? ' · ' + f.comment : ''}`, key: f.key })))
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
  const ds = document.querySelector<HTMLDetailsElement>('details.dsel[open]');
  if (ds && !ds.contains(t)) ds.open = false; // a click outside closes the community picker
  const ph = t.closest<HTMLElement>('[data-photo]');
  if (ph) { openLB(ph.dataset.photo!, Number(ph.dataset.n)); return; }
  const rnd = t.closest<HTMLElement>('[data-round]');
  if (rnd) { V.round = rnd.dataset.round!; V.f.limit = 5; rerender(); return; }
  const au = t.closest<HTMLElement>('[data-audit]');
  if (au) { go(route + '.' + au.dataset.audit); return; }
  const cr = t.closest<HTMLElement>('[data-crit]');
  if (cr && !cr.dataset.go) {
    V.f.crit = cr.dataset.crit!;
    // On a community page the criticality bar opens the findings list below, filtered.
    const toList = route.startsWith('c-') && !!cr.closest('.dmix');
    if (toList) OPEN.add('fold:findings');
    rerender();
    if (toList) document.querySelector('[data-fold="findings"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const kt = t.closest<HTMLElement>('[data-kitchen]');
  if (kt) { V.f.kitchen = kt.dataset.kitchen!; rerender(); return; }
  const tg = t.closest<HTMLElement>('[data-toggle]');
  if (tg) { const k = tg.dataset.toggle as 'repeat' | 'photos'; V.f[k] = !V.f[k]; rerender(); return; }
  const pt = t.closest<HTMLElement>('[data-pbtheme]');
  if (pt) { PB.theme = pt.dataset.pbtheme!; rerender(); return; }
  const act = t.closest<HTMLElement>('[data-act]');
  if (act) { void doAct(act.dataset.act!); return; }
  const g = t.closest<HTMLElement>('[data-go]');
  if (g && !t.closest('a')) {
    // Links into Findings start from a clean filter, carrying the dashboard's community selection and what was clicked.
    if (g.dataset.go === 'findings' && route !== 'findings') V.f = { ...emptyFilters(), ...fromDash(), ...(g.dataset.crit ? { crit: g.dataset.crit } : {}), ...(g.dataset.cap ? { cap: g.dataset.cap } : {}), ...(g.dataset.section ? { section: g.dataset.section } : {}), ...(g.dataset.community ? { community: g.dataset.community } : {}) };
    $('#side').classList.remove('open');
    go(g.dataset.go!);
    window.scrollTo(0, 0);
  }
});

/** The dashboard's community selection, for links from the dashboard into Findings. */
function fromDash(): Partial<ViewState['f']> {
  if (route !== 'dashboard') return {};
  const r = regionFilter(model);
  if (!r.region) return {};
  return { comms: model.settings.roster.filter((c) => c.active && r.inReg(c.name)).map((c) => c.name), commsLabel: r.region };
}

async function doAct(a: string): Promise<void> {
  const [k, ...rest] = a.split(':');
  const arg = rest.join(':');
  const toFindings = (patch: Partial<typeof V.f>) => { V.f = { ...emptyFilters(), ...(route === 'findings' ? { comms: V.f.comms, commsLabel: V.f.commsLabel } : fromDash()), ...patch }; if (route === 'findings') rerender(); else { go('findings'); window.scrollTo(0, 0); } };
  if (k === 'std') toFindings(route === 'findings' ? { ...V.f, std: arg, limit: 5 } : { std: arg });
  else if (k === 'crit') toFindings(route === 'findings' ? { ...V.f, crit: arg, limit: 5 } : { crit: arg });
  else if (k === 'section') toFindings(route === 'findings' ? { ...V.f, section: arg, limit: 5 } : { section: arg });
  else if (k === 'theme') toFindings({ theme: arg });
  else if (k === 'repeat') toFindings({ std: arg, repeat: true });
  else if (k === 'round') { V.round = arg; rerender(); }
  else if (k === 'clear-std') { V.f.std = ''; rerender(); }
  else if (k === 'mitigate') {
    // Editors record that a high-risk finding's immediate risk is remediated while the full solution is in progress.
    const cur = new Set(settings.mitigated ?? []);
    if (cur.has(arg)) cur.delete(arg); else cur.add(arg);
    await saveSettings({ ...settings, mitigated: [...cur] });
  }
  else if (k === 'clear-comms') { V.f.comms = null; V.f.commsLabel = ''; rerender(); }
  else if (k === 'share') copyText(shareUrl(), 'Link copied. Anyone you have shared the page with can open it.');
  else if (k === 'copy-summary') { const r = regionFilter(model); copyText(briefingText(model, V, SHARE_BASE || location.href.split('#')[0], r.inReg, r.region), 'Summary copied. Paste it into an email or Teams message.'); }
  else if (k === 'copy-community') copyText(communityText(arg), 'Summary copied. Paste it into an email or Teams message.');
  else if (k === 'scroll') document.getElementById(arg)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else if (k === 'sel') { selectionAct(model, arg); rerender(); }
  else if (k === 'pest') { setPestTab(arg); rerender(); }
  else if (k === 'expand') { if (OPEN.has(arg)) OPEN.delete(arg); else OPEN.add(arg); rerender(); }
  else if (k === 'std-photos') toFindings({ std: arg, photos: false });
  else if (k === 'pb-cited') { PB.cited = !PB.cited; rerender(); }
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

/* ---------- shell ---------- */
function shell(): void {
  document.body.insertAdjacentHTML('afterbegin', `<div class="app">
  <aside class="side" id="side">
    <h1>EcoSure Audit Review</h1>
    <p class="sub">Kisco Senior Living culinary food safety</p>
    <p class="mode" id="mode"></p><br>
    <button class="menu-toggle" id="menuBtn" aria-expanded="false" aria-controls="side">Menu</button>
    <div class="navwrap">
      <nav class="nav" id="navMain" aria-label="Dashboard"></nav>
      <details class="navfold" id="commfold"><summary>All communities</summary>
        <input id="q" type="search" placeholder="Find a community" aria-label="Find a community">
        <div class="navlegend" aria-label="Key">
          <span><span class="captag">CAP needed</span>No action plan filed</span>
          <span><span class="flag warn"></span>Plan filed, awaiting approval</span>
          <span><span class="pill s-good">85+</span><span class="pill s-warn">70</span><span class="pill s-bad">&lt;70</span>Score</span>
        </div>
        <nav class="nav" id="navComm" style="margin-top:6px" aria-label="Communities"></nav>
      </details>
      <details class="navfold" id="morefold"><summary>More detail</summary><nav class="nav" id="navMore" aria-label="More detail"></nav></details>
      <details class="navfold" id="managefold" hidden><summary>Manage</summary><nav class="nav" id="navManage" aria-label="Manage"></nav></details>
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
