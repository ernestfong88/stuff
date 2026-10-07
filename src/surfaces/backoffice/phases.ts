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
import { byPhase, PHASES, phaseIsOn, phasePlanStore, type Phase, type PhasePlan, type PhaseSwitches } from '../../store/phases';
import { MODES, modePhase } from '../../shell/modes';
import { BO_MORE_PAGES, BO_PAGES, BO_SECTIONS, type BoPageDef, type BoSectionDef } from './nav';

export {
  PHASES,
  phaseIsOn,
  phaseOnStore,
  phasePlanStore,
  resetPhases,
  setPhase,
  setPhaseOn,
  usePhaseOn,
  usePhasePlan,
  type Phase,
  type PhasePlan,
  type PhaseSwitches,
} from '../../store/phases';

/** A page's phase: the plan's call, else nav.ts, else Phase 1. */
export function phaseOf(pageId: string, plan: PhasePlan = phasePlanStore.get()): Phase {
  const parent = BO_MORE_PAGES.find((p) => p.id === pageId)?.parent;
  if (parent) return phaseOf(parent, plan);
  return plan[pageId] ?? BO_PAGES.find((p) => p.id === pageId)?.phase ?? 1;
}

/** Is this page's phase switched on? */
export const pageOn = (pageId: string, plan: PhasePlan = phasePlanStore.get(), on?: PhaseSwitches) => phaseIsOn(phaseOf(pageId, plan), on);

/**
 * The pages a section shows in the side nav: those whose phase is switched
 * on, plus the page you are on.
 */
export function visiblePages(section: BoSectionDef, on: PhaseSwitches, plan: PhasePlan, currentId?: string): BoPageDef[] {
  return byPhase(section.pages, (p) => phaseOf(p.id, plan)).filter((p) => p.id === currentId || pageOn(p.id, plan, on));
}

/** A section's phase is its earliest page's: a section is Phase 3 only when every page in it is. */
export function sectionPhase(section: BoSectionDef, plan: PhasePlan): Phase {
  return Math.min(...section.pages.map((p) => phaseOf(p.id, plan))) as Phase;
}

/** The side nav's sections: Phase 1 sections first, then Phase 2, then Phase 3, each in nav order. */
export function orderedSections(plan: PhasePlan): BoSectionDef[] {
  return byPhase(BO_SECTIONS, (s) => sectionPhase(s, plan));
}

/** The pages in a phase, in nav order. */
export function pagesInPhase(plan: PhasePlan, phase: Phase): BoPageDef[] {
  return BO_SECTIONS.flatMap((s) => s.pages).filter((p) => phaseOf(p.id, plan) === phase);
}

/** Phase 2 pages, in nav order. */
export const phaseTwoPages = (plan: PhasePlan) => pagesInPhase(plan, 2);

/** The split as plain text, to paste into an email or a ticket. */
export function phaseListText(plan: PhasePlan): string {
  return PHASES.map((ph) => {
    const lines = [
      ...MODES.filter((m) => modePhase(m.id, plan) === ph).map((m) => `  Screen › ${m.label}`),
      ...BO_SECTIONS.flatMap((sec) => sec.pages.filter((p) => phaseOf(p.id, plan) === ph).map((p) => `  Back Office › ${sec.label} › ${p.label}`)),
    ];
    return `Phase ${ph} (${lines.length} item${lines.length === 1 ? '' : 's'})\n${lines.join('\n') || '  None'}`;
  }).join('\n\n');
}
