/**
 * Who is signed in on this device, and which dining venue it is serving.
 * Both persist on the device; the venue is shared with every surface.
 */
import { rooms, staff } from '../data';
import type { StaffMember } from '../domain/types';
import { createSharedStore, useShared } from '../lib/sharedStore';

interface SessionState {
  /** Staff id of the signed-in associate, or null when signed out. */
  staffId: string | null;
  /** Room/venue key, e.g. "sequoia" or "bistro". */
  venue: string;
}

export const session = createSharedStore<SessionState>(
  { staffId: staff[0]?.id ?? null, venue: 'sequoia' },
  { persistKey: 'kisco_session' },
);

export function useSignedIn(): StaffMember | null {
  const id = useShared(session, (s) => s.staffId);
  return staff.find((s) => s.id === id) ?? null;
}

/** The signed-in associate; falls back to the first server so demos never break. */
export function useMe(): StaffMember {
  return useSignedIn() ?? staff[0];
}

export function signIn(staffId: string): void {
  session.set((s) => ({ ...s, staffId }));
}

export function signOut(): void {
  session.set((s) => ({ ...s, staffId: null }));
}

/** Check a PIN against the roster; returns the staff member on success. */
export function checkPin(pin: string): StaffMember | null {
  return staff.find((s) => s.pin === pin) ?? null;
}

export function useVenue(): [string, (v: string) => void] {
  const v = useShared(session, (s) => s.venue);
  return [rooms[v] ? v : 'sequoia', (venue) => session.set((s) => ({ ...s, venue }))];
}

const VENUE_COLORS: Record<string, string> = { sequoia: '#2F6B4F', bistro: '#B8652A' };
const VENUE_SPARE = ['#6A4F84', '#2F5577', '#9A4A3C'];

/** Two-letter code for a venue chip: "Sequoia / Evergreen" -> "SE". */
export function venueCode(key: string): string {
  const words = (rooms[key]?.name || key).split(/[^A-Za-z]+/).filter(Boolean);
  const a = words[0] || '?';
  return (a[0] + (words[1] ? words[1][0] : a.charAt(1))).toUpperCase();
}

export function venueColor(key: string): string {
  return VENUE_COLORS[key] ?? VENUE_SPARE[Math.max(0, Object.keys(rooms).indexOf(key)) % VENUE_SPARE.length];
}
