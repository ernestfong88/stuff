/**
 * Tiny external store for state that several surfaces share: the 86 list,
 * notices, side work, resident notes and so on.
 *
 * - React reads it with useSyncExternalStore (no context needed).
 * - Optional persistence to localStorage.
 * - Optional cross-tab sync over BroadcastChannel, so the kitchen screen in
 *   one tab sees what the server tablet does in another.
 */
import { useSyncExternalStore } from 'react';
import { safeStorage } from './storage';

export interface SharedStore<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
  /** Restore the initial value (and clear persistence). */
  reset(): void;
}

export interface SharedStoreOptions {
  /** localStorage key; omit to keep the state in memory only. */
  persistKey?: string;
  /** BroadcastChannel name; omit to keep the state local to this tab. */
  channel?: string;
  /**
   * A setting of this device (who is signed in, which community it shows)
   * rather than demo data: "Reset demo data" leaves it alone.
   */
  deviceSetting?: boolean;
}

/** Persisted stores holding demo data, so one action can reset them all. */
const demoStores = new Set<SharedStore<unknown>>();

/**
 * Keys that describe this device, not demo data: who is signed in, text
 * size, which kitchen screen or venue it shows, bump bar keys, the demo
 * clock, the pacing leader lease, the paper Menu Export prints on and
 * how it prints prices and diets. The back office's release phase plan is
 * a planning decision rather than demo data, so it stays too, and so does
 * who the back office is viewed as (community or Home Office).
 */
const DEVICE_KEYS = new Set([
  'kisco_session',
  'kisco_backoffice_community',
  'kisco_backoffice_role',
  'kisco_backoffice_phases',
  'kisco_backoffice_phase_view',
  'kisco_phases_on',
  'kisco_text_zoom',
  'kisco_clock_offset',
  'kisco_kds_screen',
  'kisco_bump_keys',
  'kisco_prep_venue',
  'kisco_sw_venue',
  'kisco_server_mine_mode',
  'kisco_menu_paper',
  'kisco_menu_pages',
  'kisco_menu_looks',
  'kisco-dining-leader',
]);

/**
 * Reset every persisted store except device settings, in every tab. Stores
 * of surfaces this tab never opened aren't registered here, so their saved
 * copies are cleared from storage too; they start fresh when next opened.
 */
export function resetPersistedStores(): void {
  demoStores.forEach((store) => store.reset());
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (/^kisco[._-]/.test(key) && !DEVICE_KEYS.has(key)) window.localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable */
  }
}

const instanceId = Math.random().toString(36).slice(2);

export function createSharedStore<T>(initial: T | (() => T), opts: SharedStoreOptions = {}): SharedStore<T> {
  const init = () => (typeof initial === 'function' ? (initial as () => T)() : initial);
  let state: T = (opts.persistKey ? safeStorage.getJSON<T>(opts.persistKey) : null) ?? init();
  const listeners = new Set<() => void>();
  let bc: BroadcastChannel | null = null;

  const emit = () => listeners.forEach((l) => l());

  if (opts.channel && typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(opts.channel);
    bc.onmessage = (ev: MessageEvent<{ from: string; state: T }>) => {
      if (!ev.data || ev.data.from === instanceId) return;
      state = ev.data.state;
      emit();
    };
  }

  const commit = (next: T, broadcast: boolean) => {
    if (Object.is(next, state)) return;
    state = next;
    if (opts.persistKey) safeStorage.setJSON(opts.persistKey, state);
    if (broadcast && bc) bc.postMessage({ from: instanceId, state });
    emit();
  };

  const store: SharedStore<T> = {
    get: () => state,
    set(next) {
      commit(typeof next === 'function' ? (next as (p: T) => T)(state) : next, true);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      if (opts.persistKey) safeStorage.remove(opts.persistKey);
      commit(init(), true);
    },
  };
  if (opts.persistKey && !opts.deviceSetting) demoStores.add(store as SharedStore<unknown>);
  return store;
}

/** Read a shared store (optionally a slice of it) in a component. */
export function useShared<T>(store: SharedStore<T>): T;
export function useShared<T, S>(store: SharedStore<T>, select: (s: T) => S): S;
export function useShared<T, S>(store: SharedStore<T>, select?: (s: T) => S): T | S {
  const get = () => (select ? select(store.get()) : store.get());
  return useSyncExternalStore(store.subscribe, get, get);
}
