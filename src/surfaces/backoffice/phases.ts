/**
 * Release phases: which back office pages ship in Phase 1 and which come
 * later. A page's phase comes from `phase` in nav.ts, and HO Settings ->
 * Release Phases can move any page. Pages opened from another page share the
 * phase of the page they belong under.
 *
 * The store itself is shared (src/store/phases.ts) so the mode menu can
 * phase the screens too; this file knows the Back Office pages.
 *
 * In the side nav, Phase 2 pages come after the Phase 1 pages of their
 * section, and a section that is all Phase 2 comes after every other one.
 */
import { byPhase, phasePlanStore, type Phase, type PhasePlan, type PhaseView } from '../../store/phases';
import { MODES, modePhase } from '../../shell/modes';
import { BO_MORE_PAGES, BO_PAGES, BO_SECTIONS, type BoPageDef, type BoSectionDef } from './nav';

export { phasePlanStore, resetPhases, setPhase, setPhaseView, usePhasePlan, usePhaseView, type Phase, type PhasePlan, type PhaseView } from '../../store/phases';

/** A page's phase: the plan's call, else nav.ts, else Phase 1. */
export function phaseOf(pageId: string, plan: PhasePlan = phasePlanStore.get()): Phase {
  const parent = BO_MORE_PAGES.find((p) => p.id === pageId)?.parent;
  if (parent) return phaseOf(parent, plan);
  return plan[pageId] ?? BO_PAGES.find((p) => p.id === pageId)?.phase ?? 1;
}

/**
 * The pages a section shows in the side nav. "Phase 1 only" hides Phase 2
 * pages, but never the page you are on.
 */
export function visiblePages(section: BoSectionDef, view: PhaseView, plan: PhasePlan, currentId?: string): BoPageDef[] {
  const pages = byPhase(section.pages, (p) => phaseOf(p.id, plan));
  if (view === 'all') return pages;
  return pages.filter((p) => p.id === currentId || phaseOf(p.id, plan) === 1);
}

/** A section is Phase 2 when every page in it is. */
export function sectionPhase(section: BoSectionDef, plan: PhasePlan): Phase {
  return section.pages.every((p) => phaseOf(p.id, plan) === 2) ? 2 : 1;
}

/** The side nav's sections: those with any Phase 1 page first, then all-Phase 2 sections, each in nav order. */
export function orderedSections(plan: PhasePlan): BoSectionDef[] {
  return byPhase(BO_SECTIONS, (s) => sectionPhase(s, plan));
}

/** Phase 2 pages, in nav order. */
export function phaseTwoPages(plan: PhasePlan): BoPageDef[] {
  return BO_SECTIONS.flatMap((s) => s.pages).filter((p) => phaseOf(p.id, plan) === 2);
}

/** The split as plain text, to paste into an email or a ticket. */
export function phaseListText(plan: PhasePlan): string {
  return ([1, 2] as Phase[])
    .map((ph) => {
      const lines = [
        ...MODES.filter((m) => modePhase(m.id, plan) === ph).map((m) => `  Screen › ${m.label}`),
        ...BO_SECTIONS.flatMap((sec) => sec.pages.filter((p) => phaseOf(p.id, plan) === ph).map((p) => `  Back Office › ${sec.label} › ${p.label}`)),
      ];
      return `Phase ${ph} (${lines.length} item${lines.length === 1 ? '' : 's'})\n${lines.join('\n') || '  None'}`;
    })
    .join('\n\n');
}
