import { beforeEach, describe, expect, it } from 'vitest';
import { MODES, modePhase, modePhaseKey, orderedModes } from '../../../../shell/modes';
import { BO_PAGES, BO_SECTIONS } from '../../nav';
import { orderedSections, phaseListText, phaseOf, phasePlanStore, phaseTwoPages, resetPhases, sectionPhase, setPhase, visiblePages } from '../../phases';

describe('release phases', () => {
  beforeEach(() => resetPhases());

  it('starts with the agreed split: KDS Settings in Phase 2, production, side work, kiosk and export in Phase 3', () => {
    expect(phaseTwoPages(phasePlanStore.get()).map((p) => p.id)).toEqual(['kds']);
    expect(BO_PAGES.filter((p) => phaseOf(p.id) === 3).map((p) => p.id)).toEqual(['export', 'production', 'prepList', 'cleaningLog', 'tempLog', 'swLib', 'swAssign', 'svcKiosk']);
    expect(MODES.filter((m) => modePhase(m.id, {}) === 2).map((m) => m.id)).toEqual(['host', 'bar', 'cook', 'expo', 'assocphone']);
  });

  it('keeps the Back Office screen in Phase 1 whatever a saved plan says', () => {
    expect(modePhase('backoffice', { [modePhaseKey('backoffice')]: 2 })).toBe(1);
    expect(modePhase('server', { [modePhaseKey('server')]: 2 })).toBe(2);
  });

  it('moves a page to Phase 2, and pages opened from it follow', () => {
    setPhase('resProfiles', 2);
    expect(phaseOf('resProfiles')).toBe(2);
    expect(phaseOf('svcRes')).toBe(2);
  });

  it('lists Phase 2 pages after the Phase 1 pages of their section', () => {
    const menus = BO_SECTIONS.find((s) => s.id === 'menus')!;
    setPhase('recipes', 2);
    const ids = visiblePages(menus, {}, phasePlanStore.get()).map((p) => p.id);
    // Phase 1 pages in nav order, then Recipe Book (now Phase 2), then Menu Export (Phase 3).
    expect(ids.slice(-2)).toEqual(['recipes', 'export']);
    expect(ids.slice(0, -2)).toEqual(menus.pages.filter((p) => p.id !== 'recipes' && p.id !== 'export').map((p) => p.id));
  });

  it('moves a section that is all Phase 2 below the Phase 1 sections, and Phase 3 sections below that', () => {
    const plan = phasePlanStore.get();
    const order = orderedSections(plan);
    const phases = order.map((s) => sectionPhase(s, plan));
    expect(phases).toEqual([...phases].sort());
    expect(order.map((s) => s.id).indexOf('kds')).toBe(phases.indexOf(2));
    setPhase('kds', 1);
    expect(orderedSections(phasePlanStore.get()).map((s) => s.id)).not.toContain(undefined);
    expect(sectionPhase(BO_SECTIONS.find((s) => s.id === 'kds')!, phasePlanStore.get())).toBe(1);
  });

  it('a phase switched off hides its pages but keeps the page you are on', () => {
    const menus = BO_SECTIONS.find((s) => s.id === 'menus')!;
    setPhase('export', 2);
    const plan = phasePlanStore.get();
    expect(visiblePages(menus, { 2: false }, plan).map((p) => p.id)).not.toContain('export');
    expect(visiblePages(menus, { 2: false }, plan, 'export').map((p) => p.id)).toContain('export');
  });

  it('puts later phases at the end of the screen menu', () => {
    setPhase(modePhaseKey('kiosk'), 2);
    const ids = orderedModes(phasePlanStore.get()).map((m) => m.id);
    expect(ids.slice(-3)).toEqual(['kiosk', 'prep', 'display']);
    expect(ids[0]).toBe('server');
  });
});

describe('phase 3', () => {
  beforeEach(() => resetPhases());

  it('moves a page and a screen to Phase 3', () => {
    setPhase('access', 3);
    setPhase(modePhaseKey('server'), 3);
    const plan = phasePlanStore.get();
    expect(orderedSections(plan).map((s) => s.id).at(-1)).not.toBe('kds');
    expect(orderedModes(plan).map((m) => m.id).slice(-4)).toEqual(['server', 'prep', 'kiosk', 'display']);
    expect(phaseListText(plan)).toContain('Back Office › Associates & PINs › Associates & PINs');
  });
});

describe('the standard phase split', () => {
  it('matches the agreed list', () => {
    expect(phaseListText({})).toBe(`Phase 1 (26 items)
  Screen › Server
  Screen › Manager
  Screen › PU & Delivery
  Screen › Back Office
  Back Office › Metrics & Reporting › Dashboard
  Back Office › Metrics & Reporting › P-Mix
  Back Office › Metrics & Reporting › Closing Reports
  Back Office › Menus & Recipes › Recipe Book
  Back Office › Menus & Recipes › Menu Cycle & À la Carte
  Back Office › Menus & Recipes › Associate Meals
  Back Office › Venues › Venue Settings
  Back Office › Venues › Printers
  Back Office › POS Settings › Pacing & Coursing
  Back Office › POS Settings › Pick Up & Delivery
  Back Office › POS Settings › Messages
  Back Office › POS Settings › Modifiers
  Back Office › Resident Dining Profiles › Resident Dining Profiles
  Back Office › Billing › Charge Approval
  Back Office › Billing › Order History
  Back Office › Billing › Meal Plans
  Back Office › Associates & PINs › Associates & PINs
  Back Office › HO Settings › Alerts & Timing
  Back Office › HO Settings › Shift Metrics
  Back Office › HO Settings › Meal Credits
  Back Office › HO Settings › Recipe Approval
  Back Office › HO Settings › Release Phases

Phase 2 (6 items)
  Screen › Host
  Screen › Bar
  Screen › Cook
  Screen › Expo
  Screen › Associate Phone
  Back Office › KDS › KDS Settings

Phase 3 (11 items)
  Screen › Production Prep
  Screen › Resident Kiosk
  Screen › Specials Display
  Back Office › Menus & Recipes › Menu Export
  Back Office › Productions and Checklists › Production
  Back Office › Productions and Checklists › Prep Checklist
  Back Office › Productions and Checklists › Cleaning Log
  Back Office › Productions and Checklists › Temperature Log
  Back Office › Productions and Checklists › Side Work Tasks
  Back Office › Productions and Checklists › Assign Side Work
  Back Office › Kiosk › Kiosk Settings`);
  });
});
