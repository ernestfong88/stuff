import { beforeEach, describe, expect, it } from 'vitest';
import { BO_PAGES, BO_SECTIONS } from '../../nav';
import { phaseListText, phaseOf, phasePlanStore, phaseTwoPages, resetPhases, setPhase, visiblePages } from '../../phases';

describe('release phases', () => {
  beforeEach(() => resetPhases());

  it('starts with every page in Phase 1', () => {
    expect(BO_PAGES.every((p) => phaseOf(p.id) === 1)).toBe(true);
    expect(phaseTwoPages(phasePlanStore.get())).toEqual([]);
  });

  it('moves a page to Phase 2, and pages opened from it follow', () => {
    setPhase('resProfiles', 2);
    expect(phaseOf('resProfiles')).toBe(2);
    expect(phaseOf('svcRes')).toBe(2);
    expect(phaseTwoPages(phasePlanStore.get()).map((p) => p.id)).toEqual(['resProfiles']);
  });

  it('"Phase 1 only" hides Phase 2 pages but keeps the page you are on', () => {
    const menus = BO_SECTIONS.find((s) => s.id === 'menus')!;
    setPhase('export', 2);
    const plan = phasePlanStore.get();
    expect(visiblePages(menus, 'all', plan).map((p) => p.id)).toContain('export');
    expect(visiblePages(menus, 'p1', plan).map((p) => p.id)).not.toContain('export');
    expect(visiblePages(menus, 'p1', plan, 'export').map((p) => p.id)).toContain('export');
  });

  it('copies the split as a list by section', () => {
    setPhase('pmix', 2);
    const text = phaseListText(phasePlanStore.get());
    expect(text).toContain('Phase 2 (1 page)\n  Today › P-Mix');
    expect(text).toContain(`Phase 1 (${BO_PAGES.length - 1} pages)`);
  });
});
