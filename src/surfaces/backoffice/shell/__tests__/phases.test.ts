import { beforeEach, describe, expect, it } from 'vitest';
import { MODES, modePhase, modePhaseKey, orderedModes } from '../../../../shell/modes';
import { BO_PAGES, BO_SECTIONS } from '../../nav';
import { orderedSections, phaseListText, phaseOf, phasePlanStore, phaseTwoPages, resetPhases, setPhase, visiblePages } from '../../phases';

describe('release phases', () => {
  beforeEach(() => resetPhases());

  it('starts with KDS Settings, Cook and Expo in Phase 2 and everything else in Phase 1', () => {
    expect(phaseTwoPages(phasePlanStore.get()).map((p) => p.id)).toEqual(['kds']);
    expect(BO_PAGES.filter((p) => p.id !== 'kds').every((p) => phaseOf(p.id) === 1)).toBe(true);
    expect(MODES.filter((m) => modePhase(m.id, {}) === 2).map((m) => m.id)).toEqual(['cook', 'expo']);
  });

  it('moves a page to Phase 2, and pages opened from it follow', () => {
    setPhase('resProfiles', 2);
    expect(phaseOf('resProfiles')).toBe(2);
    expect(phaseOf('svcRes')).toBe(2);
  });

  it('lists Phase 2 pages after the Phase 1 pages of their section', () => {
    const menus = BO_SECTIONS.find((s) => s.id === 'menus')!;
    setPhase('recipes', 2);
    const ids = visiblePages(menus, 'all', phasePlanStore.get()).map((p) => p.id);
    expect(ids[ids.length - 1]).toBe('recipes');
    expect(ids.slice(0, -1)).toEqual(menus.pages.filter((p) => p.id !== 'recipes').map((p) => p.id));
  });

  it('moves a section that is all Phase 2 below every other section', () => {
    const order = orderedSections(phasePlanStore.get()).map((s) => s.id);
    expect(order[order.length - 1]).toBe('kds');
    setPhase('kds', 1);
    expect(orderedSections(phasePlanStore.get()).map((s) => s.id)).toEqual(BO_SECTIONS.map((s) => s.id));
  });

  it('"Phase 1 only" hides Phase 2 pages but keeps the page you are on', () => {
    const menus = BO_SECTIONS.find((s) => s.id === 'menus')!;
    setPhase('export', 2);
    const plan = phasePlanStore.get();
    expect(visiblePages(menus, 'p1', plan).map((p) => p.id)).not.toContain('export');
    expect(visiblePages(menus, 'p1', plan, 'export').map((p) => p.id)).toContain('export');
  });

  it('puts Phase 2 screens at the end of the screen menu', () => {
    setPhase(modePhaseKey('kiosk'), 2);
    const ids = orderedModes(phasePlanStore.get()).map((m) => m.id);
    expect(ids.slice(-3)).toEqual(['cook', 'expo', 'kiosk']);
    expect(ids[0]).toBe('server');
  });

  it('copies the split as a list, screens then pages', () => {
    const text = phaseListText(phasePlanStore.get());
    expect(text).toContain('Phase 2 (3 items)\n  Screen › Cook\n  Screen › Expo\n  Back Office › KDS › KDS Settings');
  });
});
