/**
 * Finding the resident at the kiosk. Residents sign in with the last four
 * digits of a phone on file, mobile or home. Anyone without a phone, or
 * whose digits find no one, can use their apartment number instead.
 */
import type { Resident } from '../../../domain/types';
import { residentsByPhoneDigits } from '../../pud/service/phones';

/**
 * Apartment numbers compare as upper case letters and digits only, so "12b"
 * and "B-204" match what the pad types.
 */
export const aptKey = (apt: string | null | undefined) => String(apt ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** The letters that appear in this community's apartment numbers; the pad shows only these. */
export function aptLetters(list: Resident[]): string[] {
  return [...new Set(list.filter((r) => r.name).flatMap((r) => aptKey(r.apt).match(/[A-Z]/g) ?? []))].sort();
}

export function residentsByApt(list: Resident[], typed: string): Resident[] {
  return list.filter((r) => r.name && aptKey(r.apt) === typed);
}

/** Who matches what was typed on the pad. */
export function findResidents(list: Resident[], by: 'phone' | 'apt', typed: string): Resident[] {
  return by === 'apt' ? residentsByApt(list, typed) : residentsByPhoneDigits(list, typed);
}
