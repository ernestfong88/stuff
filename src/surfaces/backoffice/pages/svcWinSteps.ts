/**
 * Pick Up & Delivery step-by-step setup: the steps, which ones look
 * unfinished, and the plain review summary per venue. Pure; the wizard
 * (SvcWinSetup.tsx) reads the same settings the page saves.
 */
import { rooms } from '../../../data';
import { venueFee } from '../../../domain/billing';
import { flag, type DiningConfig } from '../../../domain/config';
import type { MealName } from '../../../domain/types';
import { sickConfig } from '../../../domain/waivers';
import {
  MEAL_WINDOWS,
  WINDOW_TYPES,
  minuteLabel,
  nocMadeBy,
  nocStarts,
  windowCaps,
  windowCutoff,
  windowStarts,
  windowTypeOn,
  type WindowSettings,
  type WindowType,
} from '../../../domain/pickupService/windows';

export const SETUP_STEPS = [
  { id: 'types', title: 'Order types', line: 'Which venues take pick up and delivery orders.' },
  { id: 'ranges', title: 'Ranges offered', line: 'When each venue offers them, meal by meal.' },
  { id: 'capacity', title: 'How many per range', line: 'How many orders one 15 minute range can take.' },
  { id: 'timing', title: 'Timing', line: 'When ordering closes and when the kitchen starts cooking.' },
  { id: 'fees', title: 'Fees & waivers', line: 'What pick up and delivery cost, and who skips the fee.' },
  { id: 'review', title: 'Review', line: 'Check each venue, then finish.' },
] as const;

export type SetupStep = (typeof SETUP_STEPS)[number]['id'];

/** Everything the summary and the checks read. */
export interface SetupInput {
  win: WindowSettings;
  cfg: DiningConfig;
  community: string;
  /** Minutes before a range the kitchen fires (pickupLeadMinutes). */
  lead: number;
  /** Venue ids, in page order (every venue by default). */
  venues?: string[];
}

export interface SetupIssue {
  step: SetupStep;
  text: string;
}

export interface SetupLine {
  step: SetupStep;
  text: string;
}

const venueIds = (i: SetupInput) => i.venues ?? Object.keys(rooms);
const venueName = (id: string) => rooms[id]?.name ?? id;
const money = (v: number) => (v > 0 ? `$${v.toFixed(2)}` : 'free');

/** "a", "a and b", "a, b and c". */
export function andList(parts: string[]): string {
  return parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** 450, 465 … 555 → "7:30 – 9:30 AM"; gaps make more than one span. */
export function spansText(starts: number[]): string {
  const spans: Array<[number, number]> = [];
  for (const st of starts) {
    const last = spans[spans.length - 1];
    if (last && last[1] === st) last[1] = st + 15;
    else spans.push([st, st + 15]);
  }
  return spans
    .map(([a, b]) => {
      const x = minuteLabel(a);
      const y = minuteLabel(b);
      return x.slice(-2) === y.slice(-2) ? `${x.slice(0, -3)} – ${y}` : `${x} – ${y}`;
    })
    .join(', ');
}

/** Which order types a venue offers at all: it has at least one range for them. */
export function venueOffers(win: WindowSettings, venue: string): Record<WindowType, boolean> {
  return {
    pickup: windowStarts(win, venue, 'pickup').length > 0,
    assoc: windowStarts(win, venue, 'assoc').length > 0 || nocStarts(win, venue).length > 0,
    delivery: windowStarts(win, venue, 'delivery').length > 0,
  };
}

const typeLabel = (t: WindowType) => WINDOW_TYPES.find((x) => x.id === t)?.label ?? t;
/** "Resident pick up" first in a sentence, lower case after. */
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "breakfast 7:30 – 9:30 AM, lunch 11:00 AM – 1:30 PM", or "" when none. */
function mealsText(starts: number[]): string {
  return (Object.keys(MEAL_WINDOWS) as MealName[])
    .map((m) => {
      const own = starts.filter((x) => x >= MEAL_WINDOWS[m][0] && x < MEAL_WINDOWS[m][1]);
      return own.length ? `${m.toLowerCase()} ${spansText(own)}` : '';
    })
    .filter(Boolean)
    .join(', ');
}

/** Problems that would leave a step half done, in step order. */
export function setupIssues(i: SetupInput): SetupIssue[] {
  const { win, cfg } = i;
  const out: SetupIssue[] = [];
  const ids = venueIds(i);
  const offers = ids.map((v) => ({ v, o: venueOffers(win, v) }));

  if (!offers.some(({ o }) => o.pickup || o.delivery)) out.push({ step: 'types', text: 'No venue offers pick up or delivery.' });

  for (const t of WINDOW_TYPES) {
    if (t.id === 'assoc' || !windowTypeOn(win, t.id)) continue;
    if (!offers.some(({ o }) => o[t.id])) out.push({ step: 'ranges', text: `${t.label} books a range, but no venue offers one.` });
  }

  for (const v of ids) {
    const c = windowCaps(win, v);
    if (!c.total) continue;
    for (const t of WINDOW_TYPES) {
      if (c[t.id] > c.total)
        out.push({ step: 'capacity', text: `${venueName(v)}: ${lower(t.label)} allows ${c[t.id]}, but the total per range is ${c.total}.` });
    }
  }

  const cut = windowCutoff(win);
  if (cut < i.lead) out.push({ step: 'timing', text: `Orders close ${cut} min before a range, but the kitchen fires ${i.lead} min before.` });

  const sick = sickConfig(i.community, cfg);
  if (sick.on && sick.allow === 0) out.push({ step: 'fees', text: 'Sick fee waivers are on, but the limit is 0.' });

  return out;
}

/** Steps with at least one issue. */
export function incompleteSteps(i: SetupInput): Set<SetupStep> {
  return new Set(setupIssues(i).map((x) => x.step));
}

/** One venue in plain words, one line per step so each can link back to it. */
export function venueSummary(i: SetupInput, venue: string): { name: string; lines: SetupLine[] } {
  const { win, cfg } = i;
  const o = venueOffers(win, venue);
  const offered = WINDOW_TYPES.filter((t) => o[t.id]).map((t) => t.id);
  const lines: SetupLine[] = [];

  if (!offered.length) {
    lines.push({ step: 'types', text: 'No pick up or delivery' });
    return { name: venueName(venue), lines };
  }
  const asap = offered.filter((t) => !windowTypeOn(win, t));
  lines.push({
    step: 'types',
    text:
      cap(andList(offered.map((t) => lower(typeLabel(t))))) +
      (asap.length ? ` (${andList(asap.map((t) => lower(typeLabel(t))))} as soon as it is ready)` : ''),
  });

  // Types with the same ranges share one line: "Resident pick up and delivery: lunch …".
  const groups: Array<{ types: WindowType[]; text: string }> = [];
  for (const t of offered) {
    if (!windowTypeOn(win, t)) continue;
    let text = mealsText(windowStarts(win, venue, t));
    if (t === 'assoc' && nocStarts(win, venue).length) text = [text, `NOC ${spansText(nocStarts(win, venue))}`].filter(Boolean).join(', ');
    const same = groups.find((g) => g.text === text);
    if (same) same.types.push(t);
    else groups.push({ types: [t], text });
  }
  for (const g of groups) {
    lines.push({ step: 'ranges', text: `${cap(andList(g.types.map((t) => lower(typeLabel(t)))))}: ${g.text}, every 15 min` });
  }

  const c = windowCaps(win, venue);
  const perType = offered.filter((t) => c[t] > 0).map((t) => `${lower(typeLabel(t))} ${c[t]}`);
  lines.push({
    step: 'capacity',
    text: (c.total ? `${c.total} per range` : 'No limit per range') + (perType.length ? ` (${perType.join(', ')})` : ''),
  });

  const f = venueFee(venue, cfg);
  const fees = [o.delivery && `delivery ${money(f.delivery)}`, o.pickup && `pick up ${money(f.pickup)}`].filter(Boolean) as string[];
  lines.push({ step: 'fees', text: fees.length ? cap(fees.join(', ')) : 'No fee' });

  return { name: venueName(venue), lines };
}

/** What applies at every venue: timing and the waivers. */
export function everywhereSummary(i: SetupInput): SetupLine[] {
  const { win, cfg } = i;
  const cut = windowCutoff(win);
  const sick = sickConfig(i.community, cfg);
  const hospice = flag(cfg, 'freeDeliveryComp');
  return [
    { step: 'timing', text: `Order ${cut} min ahead, kitchen fires ${i.lead} min before, NOC meals made by ${minuteLabel(nocMadeBy(win))}` },
    {
      step: 'fees',
      text: [
        sick.on ? `Sick waivers: ${sick.allow} per resident a month` : 'No sick waivers',
        hospice ? 'hospice delivery free' : 'hospice delivery charged',
      ].join(', '),
    },
  ];
}
