/**
 * The dining state container behind DiningProvider, without React.
 *
 * - Every local change is posted to the other tabs over BroadcastChannel at
 *   once, and saved to localStorage (versioned key, one demo day at a time)
 *   a moment later, the latest of a run of changes only (writeBehind.ts).
 * - Messages carry the sender's tab id and a per-tab sequence number: a tab
 *   ignores its own echo and anything older than what it already applied
 *   from that sender. Applying a remote state never re-broadcasts it.
 * - The course pacing timer must run in only one tab; claimPacingLeadership
 *   is the localStorage lease that decides which.
 */
import { seedDiningState, type DiningState } from '../domain/diningState';
import { now, today } from '../lib/clock';
import { safeStorage } from '../lib/storage';
import { flushWrites, writeBehind } from '../lib/writeBehind';

export const DINING_STORAGE_KEY = 'kisco.dining.v1';
export const DINING_CHANNEL = 'kisco-dining-orders';
export const LEADER_KEY = 'kisco-dining-leader';
/** A leader that has not renewed its lease for this long is replaced. */
export const LEADER_LEASE_MS = 6000;

interface SavedDining extends DiningState {
  v: 1;
  /** Demo day the state belongs to; another day's state falls back to the seed. */
  day: string;
}

interface SyncMessage {
  from: string;
  seq: number;
  orders?: DiningState['orders'];
  history?: DiningState['history'];
  assoc?: DiningState['assocOrders'];
}

export interface DiningEngine {
  /** This tab's id (used for sync and the pacing lease). */
  readonly tabId: string;
  get(): DiningState;
  subscribe(listener: () => void): () => void;
  /** Apply a local change: notify, persist and broadcast (skipped when fn returns the same state). */
  update(fn: (s: DiningState) => DiningState): void;
  /** Start cross-tab sync; returns the function that stops it. */
  connect(): () => void;
  /** Back to the seed, everywhere. */
  reset(): void;
}

function loadSaved(key: string): DiningState | null {
  const saved = safeStorage.getJSON<Partial<SavedDining>>(key);
  if (!saved || saved.v !== 1 || saved.day !== today().toDateString()) return null;
  if (!Array.isArray(saved.orders) || !Array.isArray(saved.history) || !Array.isArray(saved.assocOrders)) return null;
  return { orders: saved.orders, history: saved.history, assocOrders: saved.assocOrders };
}

export interface DiningEngineOptions {
  persistKey?: string | null;
  channel?: string | null;
  seed?: () => DiningState;
}

export function createDiningEngine(opts: DiningEngineOptions = {}): DiningEngine {
  const persistKey = opts.persistKey === undefined ? DINING_STORAGE_KEY : opts.persistKey;
  const channelName = opts.channel === undefined ? DINING_CHANNEL : opts.channel;
  const seed = opts.seed ?? seedDiningState;
  const tabId = Math.random().toString(36).slice(2);

  let state: DiningState = (persistKey && loadSaved(persistKey)) || seed();
  const listeners = new Set<() => void>();
  let channel: BroadcastChannel | null = null;
  let seq = 0;
  /** Highest sequence number applied from each other tab. */
  const lastSeen: Record<string, number> = {};

  const emit = () => listeners.forEach((l) => l());

  const save = () => {
    if (!persistKey) return;
    const saved: SavedDining = { v: 1, day: today().toDateString(), ...state };
    safeStorage.setJSON(persistKey, saved);
  };
  const persist = () => {
    if (persistKey) writeBehind(persistKey, save);
  };

  const broadcast = () => {
    const msg: SyncMessage = {
      from: tabId,
      seq: ++seq,
      orders: state.orders,
      history: state.history,
      assoc: state.assocOrders,
    };
    channel?.postMessage(msg);
  };

  const receive = (ev: MessageEvent<SyncMessage>) => {
    const m = ev.data;
    if (!m || m.from === tabId) return;
    if (m.seq <= (lastSeen[m.from] || 0)) return;
    lastSeen[m.from] = m.seq;
    state = {
      orders: m.orders ?? state.orders,
      history: m.history ?? state.history,
      assocOrders: m.assoc ?? state.assocOrders,
    };
    emit();
  };

  const commit = (next: DiningState) => {
    if (next === state) return;
    state = next;
    persist();
    broadcast();
    emit();
  };

  return {
    tabId,
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(fn) {
      commit(fn(state));
    },
    connect() {
      if (!channelName || typeof BroadcastChannel === 'undefined') return () => {};
      const bc = new BroadcastChannel(channelName);
      bc.onmessage = receive;
      channel = bc;
      return () => {
        bc.close();
        if (channel === bc) channel = null;
      };
    },
    reset() {
      if (persistKey) safeStorage.remove(persistKey);
      commit(seed());
      if (persistKey) flushWrites(persistKey);
    },
  };
}

/**
 * Claim or renew the pacing lease for this tab. True when this tab should
 * run the pacing timer: nobody holds the lease, the holder has gone quiet
 * for LEADER_LEASE_MS, or this tab already holds it. Without storage every
 * tab runs it.
 */
export function claimPacingLeadership(tabId: string): boolean {
  try {
    const raw = window.localStorage.getItem(LEADER_KEY);
    const lease = raw ? (JSON.parse(raw) as { id: string; t: number }) : null;
    if (!lease || now() - lease.t > LEADER_LEASE_MS || lease.id === tabId) {
      window.localStorage.setItem(LEADER_KEY, JSON.stringify({ id: tabId, t: now() }));
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** Give up the lease (on unmount) so another tab takes over at once. */
export function releasePacingLeadership(tabId: string): void {
  try {
    const raw = window.localStorage.getItem(LEADER_KEY);
    if (raw && (JSON.parse(raw) as { id: string }).id === tabId) window.localStorage.removeItem(LEADER_KEY);
  } catch {
    /* storage unavailable */
  }
}
