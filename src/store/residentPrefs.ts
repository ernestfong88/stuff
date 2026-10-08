/**
 * Dining preferences saved from a resident profile ("usually the salmon,
 * dressing on the side"), shared by the dining app and Back Office so a
 * change in one shows in the other. Keyed by resident id; a resident with
 * no entry falls back to Resident.fav.
 */
import { getResident } from '../data';
import { createSharedStore, useShared } from '../lib/sharedStore';

export type ResidentPrefs = Record<string, string>;

export const residentPrefsStore = createSharedStore<ResidentPrefs>({}, {
  persistKey: 'kisco.resPrefs.v1',
  channel: 'kisco-res-prefs',
});

/** Every saved preference, by resident id. */
export function useResidentPrefs(): ResidentPrefs {
  return useShared(residentPrefsStore);
}

/** Save a resident's preference text. */
export function updateResidentPref(residentId: string, text: string): void {
  residentPrefsStore.set((p) => ({ ...p, [residentId]: text }));
}

/** The preference to show: the saved one, else the resident's favourite on file. */
export function residentPref(prefs: ResidentPrefs, residentId: string): string {
  return prefs[residentId] !== undefined ? prefs[residentId] : getResident(residentId)?.fav || '';
}
