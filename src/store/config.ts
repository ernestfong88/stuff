/**
 * The community's dining settings (coursing, routing, fees, waivers, flags),
 * persisted and shared across tabs. Back Office writes it; the dining
 * logic reads it on every action and pacing tick.
 */
import { useMemo } from 'react';
import { DEFAULT_CONFIG, type DiningConfig, type HospiceStatus } from '../domain/config';
import { hospiceStatus, nextHospiceStatus } from '../domain/waivers';
import { createSharedStore, useShared } from '../lib/sharedStore';
import { barScreenOn, kdsOn, phaseOnStore, phasePlanStore, type PhasePlan, type PhaseSwitches } from './phases';

export const configStore = createSharedStore<DiningConfig>(() => structuredClone(DEFAULT_CONFIG), {
  persistKey: 'kisco.dining.config.v1',
  channel: 'kisco-dining-config',
});

/**
 * The settings in force: the saved ones with defaults filled in, and printers
 * whenever the kitchen screens' release phase is switched off.
 */
function effective(saved: DiningConfig, plan: PhasePlan, on: PhaseSwitches): DiningConfig {
  const cfg = { ...DEFAULT_CONFIG, ...saved };
  // With the Bar screen's phase off nobody works a bar: alcohol goes to the server to pour.
  const bar = barScreenOn(plan, on) ? cfg : { ...cfg, barScreen: false };
  return kdsOn(plan, on) ? bar : { ...bar, kitchenMode: 'printers' };
}

/** The current settings, with defaults filled in for anything a saved copy lacks. */
export function getConfig(): DiningConfig {
  return effective(configStore.get(), phasePlanStore.get(), phaseOnStore.get());
}

/** Read the settings in a component. */
export function useConfig(): DiningConfig {
  const saved = useShared(configStore);
  const plan = useShared(phasePlanStore);
  const on = useShared(phaseOnStore);
  return useMemo(() => effective(saved, plan, on), [saved, plan, on]);
}

/** The kitchen mode as saved, before the release phases have their say. */
export const savedKitchenMode = (saved: DiningConfig = configStore.get()) => saved.kitchenMode;

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

/**
 * Switch hospice on or off (logged, like setHospice). The undo puts the saved
 * status back exactly as it was, log included, rather than logging a second switch.
 */
export function switchHospice(rid: string, on: boolean, by: string): () => void {
  const saved = configStore.get().hospice ?? {};
  const had = Object.prototype.hasOwnProperty.call(saved, rid);
  const before = saved[rid];
  setHospice(rid, { on }, by);
  return () =>
    updateConfig((cfg) => {
      const hospice = { ...cfg.hospice };
      if (had) hospice[rid] = before;
      else delete hospice[rid];
      return { hospice };
    });
}
