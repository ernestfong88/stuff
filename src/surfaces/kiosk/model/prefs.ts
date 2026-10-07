/**
 * The kiosk remembers each resident's last drink and utensils answer on
 * this tablet, and updates them when an order is placed, so a regular is
 * asked "Coffee again?" instead of reading the whole list. A few residents
 * start with a history so both paths can be tried.
 */
import { now } from '../../../lib/clock';
import { createSharedStore, useShared } from '../../../lib/sharedStore';

export interface KioskPref {
  /** Drink name as the kiosk shows it, e.g. "Coffee". */
  drink: string | null;
  utensils: boolean;
  at?: number;
}

const SEED: Record<string, KioskPref> = {
  r1: { drink: 'Coffee', utensils: true },
  r2: { drink: 'Hot Tea', utensils: true },
  r5: { drink: 'Coffee', utensils: false },
  r7: { drink: 'Coffee', utensils: true },
  r11: { drink: 'Iced Tea', utensils: true },
};

const prefs = createSharedStore<Record<string, KioskPref>>(() => ({ ...SEED }), { persistKey: 'kisco_kiosk_prefs_v1' });

export function useKioskPref(residentId: string | null | undefined): KioskPref | null {
  return useShared(prefs, (m) => (residentId ? (m[residentId] ?? null) : null));
}

export function saveKioskPref(residentId: string, p: KioskPref): void {
  prefs.set((m) => ({ ...m, [residentId]: { ...p, at: now() } }));
}
