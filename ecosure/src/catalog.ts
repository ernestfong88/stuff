/** EcoSure standards: short labels, sections, criticality, and the visit themes they roll up to. */
import STANDARDS from './data/standards.json';
import type { Crit, Item } from './types';
import { norm } from './util';

export interface Standard {
  q: string;
  short: string;
  section: string;
  sub: string;
  crit: string;
  cid: string;
}

export const POINTS: Record<Crit, number> = { Critical: 5, Major: 3, Minor: 1, Unrated: 0 };

/** Section names by the first number of the client id. */
export const SECTION_BY_CID: Record<string, string> = {
  '1': 'Demonstration of Knowledge',
  '3': 'Good Hygienic Practices',
  '4': 'Contamination by Hands',
  '6': 'Protection from Contamination',
  '7': 'Time/Temperature Control',
  '8': 'Chemicals',
  '10': 'Insects/Rodents/Animals',
  '11': 'Facility',
};

/** Report section headers (upper case in the PDF) to display names. */
export const SECTION_NAMES: Record<string, string> = {
  'PROTECTION FROM CONTAMINATION': 'Protection from Contamination',
  'TIME / TEMPERATURE CONTROL FOR SAFETY (HIGH RISK)': 'Time/Temperature Control',
  'PREVENTING CONTAMINATION BY HANDS': 'Contamination by Hands',
  'DEMONSTRATION OF KNOWLEDGE': 'Demonstration of Knowledge',
  CHEMICALS: 'Chemicals',
  'GOOD HYGIENIC PRACTICES': 'Good Hygienic Practices',
  FACILITY: 'Facility',
  'INSECTS / RODENTS / ANIMALS': 'Insects/Rodents/Animals',
};

export const SECTIONS = Object.values(SECTION_BY_CID);

/** What to look for on a visit, grouped by theme. Every short label belongs to one theme. */
export const THEMES: { t: string; look: string; s: string[] }[] = [
  { t: 'Temperatures and logs', look: 'Probe hot and cold food and review temp and cooling logs.', s: ['Cold holding at 41°F or below', 'Hot holding at 135°F or above', 'Proper cooling before cold holding', 'Salads/sandwich items chilled within 4 hrs', 'Proper thawing', 'Temperature monitoring system/logs', 'Cooler/freezer thermometers'] },
  { t: 'Ice machines and equipment', look: 'Open the ice machine, test sanitizer, check stored pans, knives and boards.', s: ['Stored food-contact equipment clean (ice machines, pans)', 'Food-contact surfaces in good repair', 'Dish machine sanitizer concentration', 'Dish machine pressure', '3-comp sink sanitizer concentration', '3-compartment sink set up/labeled', 'Sanitizer test strips available', 'Wiping cloths/sanitizer buckets', 'Air-dry before stacking (wet nesting)', 'Proper utensils; single-use not reused'] },
  { t: 'Food storage and labeling', look: 'Walk the coolers: covered, labeled, in date, stored in the right order and off the floor.', s: ['Food storage hierarchy', 'No expired RTE product', 'RTE foods date labeled', 'Foods labeled with common name', 'Food covered/wrapped in storage', 'Food stored in appropriate locations', 'In-use utensils stored properly', 'Food-contact items/linens stored properly', 'Displayed food protected', 'Cross contamination prevented', 'Damaged cans/packages segregated', 'Produce washed properly'] },
  { t: 'Handwashing and hygiene', look: 'Watch handwashing, check hand sinks are stocked and clear, and staff drinks and items are put away.', s: ['Handwashing at appropriate times', 'Proper handwashing procedure', 'Hand sinks accessible, handwash only', 'Soap and towels at hand sinks', 'Handwash signs at all sinks', 'Hand sinks clean', 'Sink water temperature', 'Gloves used properly', 'Open wounds covered', 'No jewelry on hands/arms', 'Hair restraints worn', 'Proper eating/drinking in kitchen', 'Employee personal items stored properly'] },
  { t: 'Chemicals and pests', look: 'Look for unlabeled bottles, chemicals near food, and any signs of pests.', s: ['Chemicals labeled', 'Chemicals stored properly', 'No critical pest activity', 'Insect control devices placed properly', 'First aid/medications stored', 'Outer openings sealed (pest entry)', 'Pesticides applied by approved personnel'] },
  { t: 'Cleaning and facility', look: 'Check under and behind equipment, gaskets, hoods, vents and the dumpster area.', s: ['Non-food contact surfaces clean/in repair', 'Floors, walls, ceilings clean/in repair', 'Refrigeration gaskets clean/in repair', 'Hood system clean/in repair', 'Lighting shielded and clean', 'Dumpster area clean, lids closed', 'BOH waste containers clean', 'Covered restroom waste container', 'Plumbing in good repair'] },
  { t: 'Paperwork and postings', look: 'Ask for food handler cards, the last health inspection, and check the menu advisory.', s: ['Food handler certificates', 'Prior health inspection items corrected', 'Consumer advisory', 'Health permit current', 'Allergen awareness/policy', 'Certified manager/PIC', 'Biohazard clean-up procedures'] },
];

const OTHER_THEME = 'Cleaning and facility';
export function themeOf(short: string): string {
  return THEMES.find((t) => t.s.includes(short))?.t ?? OTHER_THEME;
}

const LIST = STANDARDS as Standard[];
const byKey = new Map<string, Standard>();
const byCid = new Map<string, Standard>();
for (const s of LIST) {
  byKey.set(norm(s.q).slice(0, 40), s);
  if (s.cid) byCid.set(s.cid, s);
}

/** Look up a standard by client id first, then by question text. */
export function findStandard(question: string, cid = ''): Standard | undefined {
  if (cid && byCid.has(cid)) return byCid.get(cid);
  const k = norm(question);
  return byKey.get(k.slice(0, 40)) ?? LIST.find((s) => { const n = norm(s.q); return n.startsWith(k.slice(0, 30)) || k.startsWith(n.slice(0, 30)); });
}

/** Learn standards from imported reports so new questions get a stable label and cid next time. */
export function learnStandard(i: Item): void {
  if (findStandard(i.question, i.cid)) return;
  const s: Standard = { q: i.question, short: i.short, section: i.section, sub: i.subsection, crit: i.criticality, cid: i.cid };
  LIST.push(s);
  byKey.set(norm(s.q).slice(0, 40), s);
  if (s.cid) byCid.set(s.cid, s);
}

export function shortLabel(question: string, cid = ''): string {
  const s = findStandard(question, cid);
  if (s) return s.short;
  const q = question.replace(/\s+/g, ' ').trim();
  return q.length > 55 ? q.slice(0, 52).replace(/\s+\S*$/, '') + '...' : q;
}

export function sectionFor(question: string, cid: string, fallback = ''): string {
  const s = findStandard(question, cid);
  if (s?.section) return s.section;
  if (cid && SECTION_BY_CID[cid.split('.')[0]]) return SECTION_BY_CID[cid.split('.')[0]];
  return fallback || 'Other';
}

export function critFor(question: string, cid: string): Crit {
  const c = findStandard(question, cid)?.crit;
  return c === 'Critical' || c === 'Major' || c === 'Minor' ? c : 'Unrated';
}

export const allStandards = (): Standard[] => LIST;
