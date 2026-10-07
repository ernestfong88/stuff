/**
 * Whether residents can put a guest's meal on their own meal plan, per
 * community. Off unless set; The Fountains has it on from the start.
 */
import { createSharedStore, useShared } from '../../../../lib/sharedStore';

const guestCreditStore = createSharedStore<Record<string, boolean>>(
  {},
  { persistKey: 'kisco_backoffice_guest_credit', channel: 'kisco-backoffice-guest-credit' },
);

const DEFAULT_ON = new Set(['The Fountains']);

export function guestCreditOn(settings: Record<string, boolean>, community: string): boolean {
  return settings[community] ?? DEFAULT_ON.has(community);
}

/** Communities with guest credits on, in the given order. */
export function communitiesWithGuestCredit(settings: Record<string, boolean>, all: string[]): string[] {
  return all.filter((c) => guestCreditOn(settings, c));
}

export function useGuestCreditSettings(): Record<string, boolean> {
  return useShared(guestCreditStore);
}

export function setGuestCredit(community: string, on: boolean): void {
  guestCreditStore.set((s) => ({ ...s, [community]: on }));
}
