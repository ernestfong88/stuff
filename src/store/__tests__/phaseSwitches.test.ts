import { afterEach, describe, expect, it } from 'vitest';
import { printerMode } from '../../domain/config';
import { getConfig, updateConfig } from '../config';
import { kdsOn, phaseIsOn, phaseOnStore, phasePlanStore, setPhaseOn } from '../phases';

afterEach(() => {
  phaseOnStore.set({});
  phasePlanStore.set({});
  updateConfig({ kitchenMode: 'kds' });
});

describe('phase switches', () => {
  it('keeps Phase 1 on and turns later phases off together', () => {
    setPhaseOn(1, false);
    expect(phaseIsOn(1)).toBe(true);
    setPhaseOn(2, false);
    expect([phaseIsOn(2), phaseIsOn(3)]).toEqual([false, false]);
    setPhaseOn(3, true);
    expect([phaseIsOn(2), phaseIsOn(3)]).toEqual([true, true]);
    setPhaseOn(3, false);
    expect([phaseIsOn(2), phaseIsOn(3)]).toEqual([true, false]);
  });

  it('runs kitchens on printers while the kitchen screens phase is off', () => {
    expect(printerMode(getConfig())).toBe(false);
    setPhaseOn(2, false);
    expect(kdsOn()).toBe(false);
    expect(printerMode(getConfig())).toBe(true);
    // Kitchen screens moved to Phase 1 stay on.
    phasePlanStore.set({ 'mode:cook': 1 });
    expect(printerMode(getConfig())).toBe(false);
  });
});

describe('features that follow their Back Office pages', () => {
  it('turns side work off with its pages’ phase', async () => {
    const { sideWorkOn, SIDE_WORK_PAGES } = await import('../sideWork');
    const { BO_PAGES } = await import('../../surfaces/backoffice/nav');
    // The standard phases here match nav.ts.
    for (const [id, ph] of Object.entries(SIDE_WORK_PAGES)) expect(BO_PAGES.find((p) => p.id === id)?.phase ?? 1).toBe(ph);
    expect(sideWorkOn()).toBe(true);
    phasePlanStore.set({ swLib: 2, swAssign: 2 });
    expect(sideWorkOn()).toBe(true);
    setPhaseOn(2, false);
    expect(sideWorkOn()).toBe(false);
  });
});
