/**
 * Release phases: which back office pages ship in Phase 1 and which come
 * later. A page's phase comes from `phase` in nav.ts, and HO Settings ->
 * Release Phases can move any page. Pages opened from another page share the
 * phase of the page they belong under.
 *
 * The plan is a decision, not demo data, so "Reset demo data" keeps it. So
 * does the side nav's "Phase 1 only" view, which is this device's choice.
 */
import { createSharedStore, useShared } from '../../lib/sharedStore';
import { BO_MORE_PAGES, BO_PAGES, BO_SECTIONS, type BoPageDef, type BoSectionDef } from './nav';

export type Phase = 1 | 2;
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

/** A page's phase: the plan's call, else nav.ts, else Phase 1. */
export function phaseOf(pageId: string, plan: PhasePlan = phasePlanStore.get()): Phase {
  const parent = BO_MORE_PAGES.find((p) => p.id === pageId)?.parent;
  if (parent) return phaseOf(parent, plan);
  return plan[pageId] ?? BO_PAGES.find((p) => p.id === pageId)?.phase ?? 1;
}

export function setPhase(pageId: string, phase: Phase): void {
  phasePlanStore.set((plan) => ({ ...plan, [pageId]: phase }));
}

/** Back to the phases in nav.ts. */
export function resetPhases(): void {
  phasePlanStore.set({});
}

/**
 * The pages a section shows in the side nav. "Phase 1 only" hides Phase 2
 * pages, but never the page you are on.
 */
export function visiblePages(section: BoSectionDef, view: PhaseView, plan: PhasePlan, currentId?: string): BoPageDef[] {
  if (view === 'all') return section.pages;
  return section.pages.filter((p) => p.id === currentId || phaseOf(p.id, plan) === 1);
}

/** Phase 2 pages, in nav order. */
export function phaseTwoPages(plan: PhasePlan): BoPageDef[] {
  return BO_SECTIONS.flatMap((s) => s.pages).filter((p) => phaseOf(p.id, plan) === 2);
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

/** The split as plain text, to paste into an email or a ticket. */
export function phaseListText(plan: PhasePlan): string {
  return ([1, 2] as Phase[])
    .map((ph) => {
      const lines = BO_SECTIONS.flatMap((sec) => sec.pages.filter((p) => phaseOf(p.id, plan) === ph).map((p) => `  ${sec.label} › ${p.label}`));
      return `Phase ${ph} (${lines.length} page${lines.length === 1 ? '' : 's'})\n${lines.join('\n') || '  None'}`;
    })
    .join('\n\n');
}
