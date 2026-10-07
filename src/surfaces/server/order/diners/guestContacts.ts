/**
 * Guests a server named at the table, saved to the host's contacts so the
 * next visit is one tap. Kept on the device and shared across its tabs.
 */
import type { Contact, Resident } from '../../../../domain/types';
import { createSharedStore, useShared } from '../../../../lib/sharedStore';

type Saved = Record<string, Contact[]>;

export const guestContactsStore = createSharedStore<Saved>({}, { persistKey: 'kisco_server_guestContacts', channel: 'kisco-server-guest-contacts' });

/** The resident's contacts on file plus guests saved here, each name once. */
export function contactsOf(r: Resident, saved: Saved): Contact[] {
  const out = [...(r.contacts ?? [])];
  for (const c of saved[r.id] ?? []) if (!out.some((x) => x.name.toLowerCase() === c.name.toLowerCase())) out.push(c);
  return out;
}

export function useContacts(r: Resident | null): Contact[] {
  const saved = useShared(guestContactsStore);
  return r ? contactsOf(r, saved) : [];
}

export function saveContact(residentId: string, name: string, rel: string): void {
  guestContactsStore.set((all) => ({
    ...all,
    [residentId]: [...(all[residentId] ?? []).filter((c) => c.name.toLowerCase() !== name.toLowerCase()), { name, rel }],
  }));
}

/** How a new guest is related to the host. */
export const GUEST_RELATIONS = ['Caregiver', 'Daughter', 'Son', 'Spouse', 'Friend', 'Unknown'];

/**
 * __kResSearch: substring matching alone puts "Delgado" behind anyone with a
 * d in their name, so rank instead: apartment first, then the start of a
 * name, then anything else. Two or three characters should be enough.
 */
export function searchPeople<T extends { name: string; apt?: string }>(list: T[], query: string, limit: number): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, limit);
  const score = (r: T) => {
    const name = r.name.toLowerCase();
    const apt = String(r.apt ?? '');
    if (apt === q) return 0;
    if (apt.startsWith(q)) return 1;
    if (name.split(' ').some((w) => w.startsWith(q))) return 2;
    if (name.includes(q)) return 3;
    return 99;
  };
  return list
    .map((r) => ({ r, s: score(r) }))
    .filter((x) => x.s < 99)
    .sort((a, b) => a.s - b.s || a.r.name.localeCompare(b.r.name))
    .slice(0, limit)
    .map((x) => x.r);
}
