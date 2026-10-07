/**
 * Service settings. The Culinary Back Office edits these (alert thresholds,
 * service flow, pick up windows, texts ...) and every dining screen reads
 * them, so a change shows on the floor right away, in every open tab.
 *
 * Paths are dot separated, e.g. getConfig('t.passLate') or
 * setConfig('flow.checkIn', false).
 */
import defaults from '../data/seed/serviceConfig.json';
import { createSharedStore, useShared } from '../lib/sharedStore';

export type ServiceConfig = typeof defaults & Record<string, unknown>;

/** Alert thresholds in minutes; a blank or 0 value turns that alert off. */
export type ThresholdKey = keyof typeof defaults.t;

export const DEFAULT_CONFIG = defaults as ServiceConfig;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const serviceConfig = createSharedStore<ServiceConfig>(() => clone(DEFAULT_CONFIG), {
  persistKey: 'kisco_service_cfg_v1',
  channel: 'kisco-service-config',
});

function readPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k]), obj);
}

/** Current value at a path, falling back to the default. */
export function getConfig<T = unknown>(path: string): T {
  const v = readPath(serviceConfig.get(), path);
  return (v === undefined ? readPath(DEFAULT_CONFIG, path) : v) as T;
}

/** Default value at a path (for "Reset to defaults" and placeholders). */
export function getDefault<T = unknown>(path: string): T {
  return readPath(DEFAULT_CONFIG, path) as T;
}

/** Set (or with undefined, remove) the value at a path. */
export function setConfig(path: string, value: unknown): void {
  serviceConfig.set((cfg) => {
    const next = clone(cfg) as Record<string, unknown>;
    const keys = path.split('.');
    const last = keys.pop()!;
    let o = next;
    for (const k of keys) {
      if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
      o = o[k] as Record<string, unknown>;
    }
    if (value === undefined) delete o[last];
    else o[last] = value;
    return next as ServiceConfig;
  });
}

/** Restore one top-level section (e.g. 't' or 'flow') to its defaults. */
export function resetConfigSection(section: string): void {
  setConfig(section, clone((DEFAULT_CONFIG as Record<string, unknown>)[section]));
}

/** Minutes before an alert turns red; Infinity when the alert is off. */
export function threshold(key: ThresholdKey): number {
  const v = Number(getConfig(`t.${key}`));
  return v > 0 ? v : Infinity;
}

/** Read a config path in a component; re-renders when it changes. */
export function useConfig<T = unknown>(path: string): T {
  useShared(serviceConfig);
  return getConfig<T>(path);
}
