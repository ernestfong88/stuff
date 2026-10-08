/**
 * Release phases: what ships in Phase 1 and what comes in Phase 2, for Back
 * Office pages (by page id) and for the screens in the mode menu (by
 * "mode:<id>"). Each item's standard phase is declared where it is defined
 * (nav.ts for pages, modes.ts for screens); this store keeps the changes
 * made in HO Settings, Release Phases.
 *
 * The plan is a decision, not demo data, so "Reset demo data" keeps it, and
 * so does which phases are switched on.
 */
import { createSharedStore, useShared } from '../lib/sharedStore';

export type Phase = 1 | 2 | 3;

export const PHASES: Phase[] = [1, 2, 3];
export type PhasePlan = Record<string, Phase>;

export const phasePlanStore = createSharedStore<PhasePlan>(
  {},
  {
    persistKey: 'kisco_backoffice_phases',
    channel: 'kisco-backoffice-phases',
    deviceSetting: true,
  },
);

export function setPhase(key: string, phase: Phase): void {
  phasePlanStore.set((plan) => ({ ...plan, [key]: phase }));
}

/** Back to every item's standard phase. */
export function resetPhases(): void {
  phasePlanStore.set({});
}

export function usePhasePlan(): PhasePlan {
  return useShared(phasePlanStore);
}

// ─── Which phases are switched on ───────────────────────────────────────

/** Phase 1 is always on; Phase 2 and 3 can be switched off for the whole system. */
export type PhaseSwitches = Partial<Record<Phase, boolean>>;

export const phaseOnStore = createSharedStore<PhaseSwitches>(
  {},
  {
    persistKey: 'kisco_phases_on',
    channel: 'kisco-phases-on',
    deviceSetting: true,
  },
);

/** Is this phase switched on? Phase 1 always is; later phases are on until switched off. */
export function phaseIsOn(phase: Phase, on: PhaseSwitches = phaseOnStore.get()): boolean {
  return phase === 1 || on[phase] !== false;
}

/** Switch a phase on or off. Turning a phase off turns off every later one; turning one on turns on the earlier ones. */
export function setPhaseOn(phase: Phase, value: boolean): void {
  if (phase === 1) return;
  phaseOnStore.set((cur) => {
    const next = { ...cur };
    for (const ph of PHASES) {
      if (ph === 1) continue;
      if (!value && ph >= phase) next[ph] = false;
      if (value && ph <= phase) next[ph] = true;
    }
    return next;
  });
}

/**
 * A floor feature that a Back Office page sets up follows that page's phase:
 * it is in use while any of its pages' phases is switched on. The pages'
 * standard phase is Phase 1 unless given here (keep in step with nav.ts).
 */
export function featureOn(pages: Record<string, Phase>, plan: PhasePlan = phasePlanStore.get(), on: PhaseSwitches = phaseOnStore.get()): boolean {
  return Object.entries(pages).some(([id, std]) => phaseIsOn(plan[id] ?? std, on));
}

export function useFeatureOn(pages: Record<string, Phase>): boolean {
  return featureOn(pages, useShared(phasePlanStore), useShared(phaseOnStore));
}

export function usePhaseOn(): PhaseSwitches {
  return useShared(phaseOnStore);
}

/**
 * Kitchen screens (Cook and Expo) ship with this phase-plan key's phase, Phase 2
 * unless moved. With that phase off, kitchens run on printers everywhere.
 */
export const KDS_PHASE_KEY = 'mode:cook';
export const KDS_DEFAULT_PHASE: Phase = 2;
export const kdsPhase = (plan: PhasePlan = phasePlanStore.get()): Phase => plan[KDS_PHASE_KEY] ?? KDS_DEFAULT_PHASE;
export const kdsOn = (plan: PhasePlan = phasePlanStore.get(), on: PhaseSwitches = phaseOnStore.get()) => phaseIsOn(kdsPhase(plan), on);

/** The Expo screen's phase is its own: with it off and Cook on, kitchens run without an expo station. */
export const expoScreenOn = (plan: PhasePlan = phasePlanStore.get(), on: PhaseSwitches = phaseOnStore.get()) =>
  phaseIsOn(plan['mode:expo'] ?? KDS_DEFAULT_PHASE, on);

/** The Bar screen (Phase 2 unless moved). With it off, nobody works a bar, so servers pour alcohol too. */
export const barScreenOn = (plan: PhasePlan = phasePlanStore.get(), on: PhaseSwitches = phaseOnStore.get()) =>
  phaseIsOn(plan['mode:bar'] ?? 2, on);

/** Phase 1 first, then Phase 2, then Phase 3, each keeping its own order. */
export function byPhase<T>(items: T[], phaseOf: (item: T) => Phase): T[] {
  return PHASES.flatMap((ph) => items.filter((x) => phaseOf(x) === ph));
}
