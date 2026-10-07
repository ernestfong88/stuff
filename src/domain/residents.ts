/**
 * Diet and allergy tags for tickets and seat cards.
 *
 * The care app sends sentences; the line needs tags. Grouping matters as
 * much as shortening: crab, clams and mussels are all "Shellfish" to a cook.
 */
import { dinerPerson } from './orders';
import type { Diner, Resident } from './types';

export const ALLERGY_ABBREVIATIONS: ReadonlyArray<[RegExp, string]> = [
  [/mussel|clam|shellfish|shrimp|crab|lobster/i, 'Shellfish'],
  [/fruits? with seeds|seeds/i, 'No seeds'],
  [/gluten/i, 'Gluten'],
  [/peanut/i, 'Peanut'],
  [/tree ?nut/i, 'Tree nut'],
];

export const DIET_ABBREVIATIONS: ReadonlyArray<[RegExp, string]> = [
  [/^no salt added$/i, 'NAS'],
  [/^low sodium$/i, 'Low Na'],
  [/^diabetic$/i, 'Diab'],
  [/^gluten[- ](friendly|free)$/i, 'GF'],
  [/^pureed$/i, 'Puree'],
  [/^nectar[- ]thick liquids$/i, 'Nectar thick'],
  [/no dairy.*soy/i, 'No dairy/soy'],
];

/** __kAbbr: the first matching abbreviation, else the text as is. */
export function abbreviate(text: string, list: ReadonlyArray<[RegExp, string]>): string {
  for (const [re, short] of list) if (re.test(text)) return short;
  return text;
}

export interface Pill {
  kind: 'allergy' | 'diet';
  text: string;
}

const chop = (prep: string) => prep.replace(/^chopped$/i, 'Chop');

/**
 * __kPills: allergy then diet tags, de-duplicated. "Mechanical Altered"
 * carries the food prep ("Mech Altered: Chop"); otherwise the prep is its
 * own tag.
 */
export function residentPills(r: Pick<Resident, 'allergies' | 'diet' | 'foodPrep'>): Pill[] {
  const out: Pill[] = [];
  const seen = new Set<string>();
  const add = (kind: Pill['kind'], text: string) => {
    const k = kind + text.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ kind, text });
    }
  };
  for (const a of r.allergies ?? []) add('allergy', abbreviate(a, ALLERGY_ABBREVIATIONS));
  const mech = (d: string) => /^mechanical altered$/i.test(d);
  for (const d of r.diet ?? []) {
    if (mech(d)) add('diet', 'Mech Altered' + (r.foodPrep ? ': ' + chop(String(r.foodPrep)) : ''));
    else add('diet', abbreviate(d, DIET_ABBREVIATIONS));
  }
  if (!(r.diet ?? []).some(mech) && r.foodPrep) add('diet', chop(String(r.foodPrep)));
  return out;
}

/**
 * __kDinerPills: tags for a seat. Only assisted living residents get them,
 * and never a guest: a guest is seated against the resident who brought
 * them, and the host's allergies and diet are not the guest's.
 */
export function dinerPills(d: Diner | null | undefined): Pill[] {
  const r = d && !d.isGuest ? (dinerPerson(d) as Resident | undefined) : undefined;
  return r && r.level === 'AL' ? residentPills(r) : [];
}
