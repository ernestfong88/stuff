import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diner, line, order } from '../../../../../domain/__tests__/helpers';
import { dinerBilling } from '../../../../../domain/billing';
import { hospiceStatus, isOnHospice } from '../../../../../domain/waivers';
import { configStore, getConfig, switchHospice } from '../../../../../store/config';
import { changeResidentPlan, residentPlan, residentRecordsStore } from '../../../../../store/residentRecords';
import { seedPlans } from '../../../seed/billing';
import { changePlanWithUndo, toggleHospiceWithUndo } from '../residentActions';

const toasts = vi.hoisted(() => [] as Array<{ message: string; opts?: { action?: { label: string; onClick: () => void } } }>);
vi.mock('../../../../../ui', () => ({ toast: (message: string, opts?: object) => toasts.push({ message, opts }) }));

const plans = seedPlans();
const marty = () => residentRecordsStore.get().find((r) => r.id === 'r1')!;

let records: ReturnType<typeof residentRecordsStore.get>;
let config: ReturnType<typeof configStore.get>;
beforeEach(() => {
  records = residentRecordsStore.get();
  config = configStore.get();
  toasts.length = 0;
});
afterEach(() => {
  residentRecordsStore.set(records);
  configStore.set(config);
});

describe('changeResidentPlan', () => {
  it('logs the change for billing, newest first, and close & charge counts the new plan', () => {
    expect(marty().planId).toBe('pl1');
    const change = changeResidentPlan('r1', 'pl3', 'EF', plans);
    expect(change).toMatchObject({ from: 'IL Resident Meal Plan', to: 'IL Spenddown' });
    expect(marty().planId).toBe('pl3');
    expect(marty().planLog?.[0]).toMatchObject({ by: 'EF', from: 'IL Resident Meal Plan', to: 'IL Spenddown' });
    expect(residentPlan('r1')).toMatchObject({ type: 'A la carte' });
    const d = diner([line('d_peach')], { refId: 'r1' });
    expect(dinerBilling(d, order([d]))).toMatchObject({ covered: false, planType: 'A la carte' });
  });

  it('undo puts back the plan and the log exactly as they were', () => {
    const before = marty();
    changeResidentPlan('r1', 'pl3', 'EF', plans)!.undo();
    expect(marty().planId).toBe(before.planId);
    expect(marty().planLog).toEqual(before.planLog);
    expect(residentPlan('r1')).toMatchObject({ type: 'Monthly', amt: 30 });
  });

  it('does nothing for the same plan or an unknown resident', () => {
    expect(changeResidentPlan('r1', 'pl1', 'EF', plans)).toBeNull();
    expect(changeResidentPlan('nobody', 'pl3', 'EF', plans)).toBeNull();
    expect(marty().planLog).toEqual(records.find((r) => r.id === 'r1')!.planLog);
  });

  it('keeps the latest 10 log entries', () => {
    for (let i = 0; i < 12; i++) changeResidentPlan('r1', i % 2 ? 'pl1' : 'pl3', 'EF', plans);
    expect(marty().planLog).toHaveLength(10);
  });
});

describe('changePlanWithUndo', () => {
  it('toasts the change with an Undo that restores the plan', () => {
    changePlanWithUndo('r1', 'Marty Martin', 'pl8');
    expect(marty().planId).toBe('pl8');
    expect(toasts[0].message).toContain("Marty's plan changed to AL 2x Meals a Day");
    toasts[0].opts!.action!.onClick();
    expect(marty().planId).toBe('pl1');
    expect(toasts[1].message).toBe("Marty's plan is back to IL Resident Meal Plan.");
  });

  it('says nothing when the plan is unchanged', () => {
    changePlanWithUndo('r1', 'Marty Martin', 'pl1');
    expect(toasts).toHaveLength(0);
  });
});

describe('hospice switch', () => {
  it('switches on with a logged entry, comps meals at close, and undo restores the saved status', () => {
    expect(isOnHospice('r1', getConfig())).toBe(false);
    const undo = switchHospice('r1', true, 'EF');
    const h = hospiceStatus('r1', getConfig())!;
    expect(h).toMatchObject({ on: true, by: 'EF' });
    expect(h.since).not.toBe('');
    expect(h.log[0]).toMatchObject({ on: true, by: 'EF' });
    const d = diner([line('d_peach')], { refId: 'r1' });
    expect(dinerBilling(d, order([d]), getConfig())).toMatchObject({ planType: 'Comp', comped: true });
    undo();
    expect(isOnHospice('r1', getConfig())).toBe(false);
    expect('r1' in configStore.get().hospice).toBe(false);
  });

  it('undo after switching a seeded hospice resident off brings back the same status', () => {
    const before = hospiceStatus('r7', getConfig());
    expect(before?.on).toBe(true);
    const undo = switchHospice('r7', false, 'EF');
    expect(isOnHospice('r7', getConfig())).toBe(false);
    undo();
    expect(hospiceStatus('r7', getConfig())).toEqual(before);
  });

  it('toggleHospiceWithUndo toasts what hospice does, with an Undo', () => {
    toggleHospiceWithUndo('r1', 'Marty Martin', true, getConfig());
    expect(isOnHospice('r1', getConfig())).toBe(true);
    expect(toasts[0].message).toBe('Marty is on hospice: meals are comped at close and delivery fees are waived from now on.');
    toasts[0].opts!.action!.onClick();
    expect(isOnHospice('r1', getConfig())).toBe(false);
    expect(toasts[1].message).toBe('Marty is back off hospice.');
  });
});
