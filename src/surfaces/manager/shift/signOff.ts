/**
 * Manager shift sign-offs, kept per day and meal so a tablet that reloads,
 * or the manager's second tablet, still shows the shift as signed.
 */
import { createSharedStore, useShared } from '../../../lib/sharedStore';
import type { MealName } from '../../../domain/types';

export interface SignOff {
  by: string;
  at: number;
}

const store = createSharedStore<Record<string, SignOff>>({}, {
  persistKey: 'kisco_manager_signoff',
  channel: 'kisco-manager-signoff',
});

const key = (day: string, meal: MealName) => `${day}|${meal}`;

export function useSignOff(day: string, meal: MealName): SignOff | null {
  return useShared(store, (s) => s[key(day, meal)] ?? null);
}

export function signOffShift(day: string, meal: MealName, by: string, at: number): void {
  store.set((s) => ({ ...s, [key(day, meal)]: { by, at } }));
}
