/**
 * Who is signed in on this device, and which dining venue it is serving.
 * Both persist on the device; the venue is shared with every surface.
 */
import { rooms, staff } from '../data';
import type { StaffMember } from '../domain/types';
import { createSharedStore, useShared } from '../lib/sharedStore';
import { pinOverrides } from '../store/pins';
import { activeRooms } from '../store/venueMenu';
import { venueSettingsStore } from '../store/venueSettings';
import { ADP_ASSOCIATES } from '../surfaces/backoffice/seed/associates';

interface SessionState {
  /** Staff id of the signed-in associate, or null when signed out. */
  staffId: string | null;
  /** Room/venue key, e.g. "sequoia" or "bistro". */
  venue: string;
}

export const session = createSharedStore<SessionState>(
  { staffId: staff[0]?.id ?? null, venue: 'sequoia' },
  { persistKey: 'kisco_session', deviceSetting: true },
);

/**
 * Everyone who can sign in with a PIN: the dining tablets' roster, then every
 * other associate on Associates & PINs who signs in with a PIN rather than a
 * Windows login (Marisol, the line cooks, the host ...).
 */
export const PIN_ROSTER: StaffMember[] = [
  ...staff,
  ...ADP_ASSOCIATES.filter((a) => !a.win && a.pin && !staff.some((s) => s.id === a.id)).map((a) => ({
    id: a.id,
    pin: a.pin!,
    name: a.name,
    initials: a.id,
    role: a.title,
  })),
];

export function useSignedIn(): StaffMember | null {
  const id = useShared(session, (s) => s.staffId);
  return PIN_ROSTER.find((s) => s.id === id) ?? null;
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

/** Check a PIN against everyone who signs in with one; returns the associate on success. A reset PIN replaces the old one. */
export function checkPin(pin: string): StaffMember | null {
  const reset = pinOverrides.get();
  return PIN_ROSTER.find((s) => (reset[s.id] ?? s.pin) === pin) ?? null;
}

/** The venues (kitchens) a floor device can serve: those with a venue that isn't retired in Venue Settings. */
export function useVenueChoices(): string[] {
  const venues = useShared(venueSettingsStore, (s) => s.venues);
  return activeRooms(Object.keys(rooms), venues);
}

export function useVenue(): [string, (v: string) => void] {
  const v = useShared(session, (s) => s.venue);
  const choices = useVenueChoices();
  return [choices.includes(v) ? v : (choices[0] ?? 'sequoia'), (venue) => session.set((s) => ({ ...s, venue }))];
}

const VENUE_COLORS: Record<string, string> = { sequoia: '#2F6B4F', bistro: '#B8652A' };
const VENUE_SPARE = ['#6A4F84', '#2F5577', '#9A4A3C'];

/** Two-letter code for a venue chip: "Sequoia / Evergreen" -> "SE". */
export function venueCode(key: string): string {
  const words = (rooms[key]?.name || key)
    .replace(/^the\s+/i, '')
    .split(/[^A-Za-z]+/)
    .filter(Boolean);
  const a = words[0] || '?';
  return (a[0] + (words[1] ? words[1][0] : a.charAt(1))).toUpperCase();
}

export function venueColor(key: string): string {
  return VENUE_COLORS[key] ?? VENUE_SPARE[Math.max(0, Object.keys(rooms).indexOf(key)) % VENUE_SPARE.length];
}
