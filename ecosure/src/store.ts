/**
 * Where records live.
 *  - shared: inside the published claude.ai page, records go to the artifact's database
 *    and photos/PDFs to its asset store, so everyone with the link sees the same data.
 *  - local: anywhere else (opened as a file, dev server), records stay in this browser (IndexedDB).
 * The starting data (the previous review page) ships inside the page as SEED and is never written;
 * a stored record with the same id replaces it, and a stored tombstone hides it.
 */
import type { Rec, Settings } from './types';
import { slug } from './util';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export function recId(r: Rec): string {
  if (r.kind === 'self') return `s~${slug(r.community)}~${slug(r.kitchen)}~${r.date}`;
  const d = r.kind === 'report' ? r.date : r.auditDate || r.submitted || 'undated';
  return `${r.kind === 'report' ? 'r' : 'c'}~${slug(r.community)}~${slug(r.kitchen)}~${d}`;
}

export interface Backend {
  mode: 'shared' | 'local';
  canWrite: boolean;
  keepsFiles: boolean;
  start(onChange: (recs: Rec[], settings: Settings | null) => void): Promise<void>;
  put(rec: Rec): Promise<void>;
  remove(id: string): Promise<void>;
  putSettings(s: Settings): Promise<void>;
  savePhoto(b: Blob): Promise<string>;
  saveFile(b: Blob): Promise<string | null>;
  download(filename: string, data: string, mime: string): Promise<void>;
}

/* ---------- photo refs ---------- */
let seedPhotos: Record<string, string> = {};
const localUrls = new Map<string, string>();
export function setSeedPhotos(p: Record<string, string>): void { seedPhotos = p; }
export function photoUrl(ref: string): string {
  if (ref.startsWith('seed:')) return seedPhotos[ref.slice(5)] ?? '';
  if (ref.startsWith('asset:')) return '/_blob/' + ref.slice(6);
  if (ref.startsWith('local:')) return localUrls.get(ref.slice(6)) ?? '';
  return ref;
}
export const fileUrl = (ref?: string): string => (ref ? photoUrl(ref) : '');

/* ---------- download fallback (plain browsers) ---------- */
function browserDownload(filename: string, data: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ---------- shared (claude.ai artifact) ---------- */
async function sharedBackend(): Promise<Backend | null> {
  const claude = (window as Any).claude;
  if (!claude?.use) return null;
  const [db, assets, user, downloads] = await Promise.all(['db', 'assets', 'user', 'downloads'].map((n) => claude.use(n).catch(() => null)));
  if (!db) return null;
  let canWrite = true;
  try { const c = user ? await user.can('data.write') : null; if (c === false) canWrite = false; } catch { /* unknown: let a refused write decide */ }
  const col = db.collection('records');
  const settingsDoc = db.doc('config/settings');
  const pack = (r: object) => JSON.parse(JSON.stringify(r));
  const be: Backend = {
    mode: 'shared', canWrite, keepsFiles: !!assets,
    async start(onChange) {
      let recs: Rec[] = [], settings: Settings | null = null, gotR = false, gotS = false;
      const fire = () => { if (gotR && gotS) onChange(recs, settings); };
      col.onSnapshot((s: Any) => { recs = s.docs.map((d: Any) => d.data() as Rec); gotR = true; fire(); }, () => { gotR = true; fire(); });
      settingsDoc.onSnapshot((d: Any) => { settings = d.exists ? (d.data() as Settings) : null; gotS = true; fire(); }, () => { gotS = true; fire(); });
    },
    async put(rec) {
      try { await col.doc(rec.id).set(pack(rec)); }
      catch (e: Any) { if (e?.code === 'invalid_argument' && !canWrite) throw new Error('You can view this page but not change its data. Ask the owner for Contributor access.'); throw new Error(e?.message ?? String(e)); }
    },
    async remove(id) { await col.doc(id).set({ id, deleted: true, kind: id.startsWith('r~') ? 'report' : id.startsWith('s~') ? 'self' : 'cap' }); },
    async putSettings(s) { await settingsDoc.set(pack(s)); },
    async savePhoto(b) {
      if (!assets) throw new Error('Photos can only be added by people who can edit this page.');
      const r = await assets.upload(b, { type: 'image/jpeg' });
      return 'asset:' + r.id;
    },
    async saveFile(b) {
      if (!assets) return null;
      try { const r = await assets.upload(b, { type: 'application/pdf' }); return 'asset:' + r.id; } catch { return null; }
    },
    async download(filename, data, mime) {
      if (downloads) { await downloads.save({ filename, data }); return; }
      browserDownload(filename, data, mime);
    },
  };
  return be;
}

/* ---------- local (IndexedDB) ---------- */
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('ecosure-review', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('records', { keyPath: 'id' }); r.result.createObjectStore('blobs'); r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    const q = f(db.transaction(store, mode).objectStore(store));
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}

async function localBackend(): Promise<Backend> {
  let db: IDBDatabase | null = null;
  try { db = await idb(); } catch { db = null; }
  let notify: (recs: Rec[], s: Settings | null) => void = () => {};
  const mem = new Map<string, Rec>();
  let memSettings: Settings | null = null;
  const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ecosure-review') : null;
  const reload = async () => {
    if (db) {
      const recs = await tx<Rec[]>(db, 'records', 'readonly', (s) => s.getAll());
      const keys = await tx<IDBValidKey[]>(db, 'blobs', 'readonly', (s) => s.getAllKeys());
      for (const k of keys) {
        if (localUrls.has(String(k))) continue;
        const b = await tx<Blob>(db, 'blobs', 'readonly', (s) => s.get(k));
        if (b) localUrls.set(String(k), URL.createObjectURL(b));
      }
      const s = await tx<Settings | undefined>(db, 'kv', 'readonly', (st) => st.get('settings'));
      notify(recs, s ?? null);
    } else notify([...mem.values()], memSettings);
  };
  chan?.addEventListener('message', () => void reload());
  const changed = async () => { await reload(); chan?.postMessage('changed'); };
  const putBlob = async (b: Blob) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    if (db) await tx(db, 'blobs', 'readwrite', (s) => s.put(b, id));
    localUrls.set(id, URL.createObjectURL(b));
    return 'local:' + id;
  };
  return {
    mode: 'local', canWrite: true, keepsFiles: true,
    async start(onChange) { notify = onChange; await reload(); },
    async put(rec) { if (db) await tx(db, 'records', 'readwrite', (s) => s.put(JSON.parse(JSON.stringify(rec)))); else mem.set(rec.id, rec); await changed(); },
    async remove(id) {
      const t = { id, deleted: true, kind: id.startsWith('r~') ? 'report' : id.startsWith('s~') ? 'self' : 'cap' } as unknown as Rec;
      if (db) await tx(db, 'records', 'readwrite', (s) => s.put(t)); else mem.set(id, t);
      await changed();
    },
    async putSettings(st) { if (db) await tx(db, 'kv', 'readwrite', (s) => s.put(JSON.parse(JSON.stringify(st)), 'settings')); else memSettings = st; await changed(); },
    savePhoto: putBlob,
    saveFile: putBlob,
    async download(filename, data, mime) { browserDownload(filename, data, mime); },
  };
}

export async function connect(): Promise<Backend> {
  try {
    const s = await sharedBackend();
    if (s) return s;
  } catch { /* fall through to local */ }
  return localBackend();
}
