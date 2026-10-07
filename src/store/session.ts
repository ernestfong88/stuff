/**
 * Who is using this device and in which mode.
 *
 * Kept per tab (each tab stands for a different device in the demo), so it
 * is neither persisted nor synced. The shell sets it; the dining store reads
 * it to attribute check timeline entries and to ask before a server changes
 * someone else's check.
 */
import type { StaffMode } from '../domain/activityLog';
import { createSharedStore, useShared } from '../lib/sharedStore';

export type { StaffMode };

export interface Session {
  mode: StaffMode;
  /** Initials of the signed-in staff member, or null when nobody is signed in. */
  me: string | null;
}

export const sessionStore = createSharedStore<Session>({ mode: 'server', me: null });

/** The current session, re-rendering on change. */
export function useSession(): Session {
  return useShared(sessionStore);
}

export function setSessionMode(mode: StaffMode): void {
  sessionStore.set((s) => (s.mode === mode ? s : { ...s, mode }));
}

/** Sign a staff member in (initials) or out (null). */
export function setSignedIn(me: string | null): void {
  sessionStore.set((s) => (s.me === me ? s : { ...s, me }));
}
