/**
 * The community's dining settings (coursing, routing, fees, waivers, flags),
 * persisted and shared across tabs. Back Office writes it; the dining
 * logic reads it on every action and pacing tick.
 */
import { useMemo } from 'react';
import { DEFAULT_CONFIG, type DiningConfig, type HospiceStatus } from '../domain/config';
import { hospiceStatus, nextHospiceStatus } from '../domain/waivers';
import { createSharedStore, useShared } from '../lib/sharedStore';

export const configStore = createSharedStore<DiningConfig>(() => structuredClone(DEFAULT_CONFIG), {
  persistKey: 'kisco.dining.config.v1',
  channel: 'kisco-dining-config',
});

/** The current settings, with defaults filled in for anything a saved copy lacks. */
export function getConfig(): DiningConfig {
  return { ...DEFAULT_CONFIG, ...configStore.get() };
}

/** Read the settings in a component. */
export function useConfig(): DiningConfig {
  const saved = useShared(configStore);
  return useMemo(() => ({ ...DEFAULT_CONFIG, ...saved }), [saved]);
}

/** Merge a change into the settings. */
export function updateConfig(patch: Partial<DiningConfig> | ((cfg: DiningConfig) => Partial<DiningConfig>)): void {
  configStore.set((prev) => {
    const cur = { ...DEFAULT_CONFIG, ...prev };
    return { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) };
  });
}

/** Override (or, with null, reset) the kitchen route of an item in a venue. */
export function setItemRoute(room: string, itemId: string, route: string | null): void {
  updateConfig((cfg) => {
    const next = { ...cfg.route };
    const key = room + '|' + itemId;
    if (route) next[key] = route;
    else delete next[key];
    return { route: next };
  });
}

/** Switch a resident's hospice status, logging who changed it. */
export function setHospice(rid: string, patch: Partial<HospiceStatus>, by: string): void {
  updateConfig((cfg) => ({ hospice: { ...cfg.hospice, [rid]: nextHospiceStatus(hospiceStatus(rid, cfg), patch, by) } }));
}
