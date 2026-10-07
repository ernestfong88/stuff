/**
 * Phone numbers on file for residents. All are made-up 555 numbers for the
 * demo. `m` is a mobile and `h` a home landline; only a mobile gets texts.
 * Rose (412) and Nora (B110) have a landline only, and Joan (224) and
 * Dorothy (12B) no phone at all, so every path can be tried at the kiosk.
 *
 * Back Office can mark a resident as having no mobile (or having one again)
 * under Text Messages; that override lives in the service settings `mobile`.
 */
import type { Resident } from '../../../domain/types';

export interface PhonesOnFile {
  m?: string;
  h?: string;
}

const IDS = ['r1', 'r1b', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15', 'r16', 'r17', 'r18', 'r19', 'r20', 'r21', 'r22', 'r23', 'r24'];
const NO_PHONE = new Set(['r6', 'r22']);
const HOME_ONLY = new Set(['r4', 'r24']);

export const PHONES: Readonly<Record<string, PhonesOnFile>> = Object.fromEntries(
  IDS.map((id, i) => {
    if (NO_PHONE.has(id)) return [id, {}];
    const n = '555555' + String(101 + i).padStart(4, '0');
    return [id, HOME_ONLY.has(id) ? { h: n } : { m: n }];
  }),
);

/** Back Office overrides: resident id → has a mobile (true/false). */
export type MobileOverrides = Record<string, boolean | number | undefined>;

/** Whether a resident has a mobile on file, by default (before any override). */
export function hasMobileByDefault(rid: string): boolean {
  return !!PHONES[rid]?.m;
}

/** Whether texts go to this resident. */
export function hasMobile(overrides: MobileOverrides | undefined, rid: string): boolean {
  const o = overrides?.[rid];
  return o != null ? !!o : hasMobileByDefault(rid);
}

/** The mobile texts go to, or "" when there is none. */
export function mobileNumber(overrides: MobileOverrides | undefined, rid: string): string {
  return (hasMobile(overrides, rid) && PHONES[rid]?.m) || '';
}

/** "5555550103" → "(555) 555-0103" */
export function formatPhone(d: string | null | undefined): string {
  return d ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : '';
}

/** "5555550103" → "(•••) •••-0103", for a screen others can see. */
export function maskPhone(d: string | null | undefined): string {
  return d ? `(•••) •••-${d.slice(-4)}` : '';
}

/** Residents with any phone on file (mobile or home) ending in these four digits. */
export function residentsByPhoneDigits(list: Resident[], digits: string): Resident[] {
  if (digits.length < 4) return [];
  return list.filter((r) => r.name && Object.values(PHONES[r.id] ?? {}).some((p) => String(p).slice(-4) === digits));
}
