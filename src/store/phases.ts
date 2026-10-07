/**
 * Release phases: what ships in Phase 1 and what comes in Phase 2, for Back
 * Office pages (by page id) and for the screens in the mode menu (by
 * "mode:<id>"). Each item's standard phase is declared where it is defined
 * (nav.ts for pages, modes.ts for screens); this store keeps the changes
 * made in HO Settings, Release Phases.
 *
 * The plan is a decision, not demo data, so "Reset demo data" keeps it. So
 * does the "Phase 1 only" view, which is this device's choice.
 */
import { createSharedStore, useShared } from '../lib/sharedStore';

export type Phase = 1 | 2 | 3;

export const PHASES: Phase[] = [1, 2, 3];
export type PhaseView = 'all' | 'p1';
export type PhasePlan = Record<string, Phase>;

export const phasePlanStore = createSharedStore<PhasePlan>({}, {
  persistKey: 'kisco_backoffice_phases',
  channel: 'kisco-backoffice-phases',
  deviceSetting: true,
});

export const phaseViewStore = createSharedStore<PhaseView>('all', {
  persistKey: 'kisco_backoffice_phase_view',
  channel: 'kisco-backoffice-phase-view',
  deviceSetting: true,
});

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

export function usePhaseView(): PhaseView {
  return useShared(phaseViewStore);
}

export function setPhaseView(view: PhaseView): void {
  phaseViewStore.set(view);
}

/** Phase 1 first, then Phase 2, then Phase 3, each keeping its own order. */
export function byPhase<T>(items: T[], phaseOf: (item: T) => Phase): T[] {
  return PHASES.flatMap((ph) => items.filter((x) => phaseOf(x) === ph));
}
