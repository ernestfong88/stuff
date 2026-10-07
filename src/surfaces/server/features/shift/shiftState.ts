/**
 * Shift review state kept on the tablet: who signed off which shift, and
 * which tab to open next (the points chip opens People notes).
 */
import { createSharedStore, useShared } from '../../../../lib/sharedStore';

export type ShiftTab = 'checks' | 'notes' | 'feedback' | 'trivia';

/** "AA|2026-10-07" → when they signed off. */
export const signOffStore = createSharedStore<Record<string, number>>({}, {
  persistKey: 'kisco_server_signoff_v1',
  channel: 'kisco-server-signoff',
});

export const signOffKey = (who: string, day: string) => `${who}|${day}`;

export function signOff(who: string, day: string, at: number): void {
  signOffStore.set((s) => ({ ...s, [signOffKey(who, day)]: at }));
}

export function useSignedOffAt(who: string, day: string): number | undefined {
  return useShared(signOffStore, (s) => s[signOffKey(who, day)]);
}

/** The tab Shift Review should open on next, set just before navigating there. */
export const requestedTab = createSharedStore<ShiftTab | null>(null);
