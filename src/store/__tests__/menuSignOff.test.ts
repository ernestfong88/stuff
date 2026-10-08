import { describe, expect, it } from 'vitest';
import { dropSignOff, EMPTY_OVERLAY, type BoMenu, type MenuEditsState } from '../menuEdits';

const menu = (m: Partial<BoMenu> & Record<string, unknown>) =>
  ({ name: 'VT Fall 2026', kind: 'cycle', quarter: 'Q4 2026', cycleLen: 35, status: 'active', ...m }) as BoMenu;
const state = (menus?: BoMenu[]): MenuEditsState => ({ live: EMPTY_OVERLAY, menus });

describe('saved menus from before the dietitian sign-off was dropped', () => {
  const old = state([
    menu({ id: 'm1', locked: true, signedBy: 'Dana Whitfield, RD', signedAt: 1, approveReq: true, approval: 'Approved' }),
    menu({ id: 'm7', locked: true, status: 'archived', signedBy: 'Dana Whitfield, RD', signedAt: 1, approveReq: true, approval: 'Approved' }),
    menu({ id: 'm5', status: 'draft', approveReq: true, approval: 'Pending signature' }),
  ]);

  it('unlocks VT Fall 2026 once and drops the sign-off fields', () => {
    const out = dropSignOff(old);
    expect(out.menus!.map((m) => [m.id, !!m.locked])).toEqual([
      ['m1', false],
      ['m7', true],
      ['m5', false],
    ]);
    expect(out.menus!.some((m) => ['signedBy', 'signedAt', 'approveReq', 'approval'].some((k) => k in m))).toBe(false);
  });

  it('leaves a menu locked by hand afterwards alone', () => {
    const migrated = dropSignOff(old);
    const relocked = { ...migrated, menus: migrated.menus!.map((m) => (m.id === 'm1' ? { ...m, locked: true } : m)) };
    expect(dropSignOff(relocked)).toBe(relocked);
  });

  it('changes nothing for the seed or a copy without the fields', () => {
    const fresh = state();
    expect(dropSignOff(fresh)).toBe(fresh);
  });
});
