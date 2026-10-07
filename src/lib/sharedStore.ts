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

  return {
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
}

/** Read a shared store (optionally a slice of it) in a component. */
export function useShared<T>(store: SharedStore<T>): T;
export function useShared<T, S>(store: SharedStore<T>, select: (s: T) => S): S;
export function useShared<T, S>(store: SharedStore<T>, select?: (s: T) => S): T | S {
  const get = () => (select ? select(store.get()) : store.get());
  return useSyncExternalStore(store.subscribe, get, get);
}
