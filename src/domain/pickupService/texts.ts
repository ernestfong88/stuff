/**
 * Text messages to residents and associates.
 *
 * A pick up gets one text, when it is packed and set out; a delivery one,
 * when the runner leaves. Only a mobile gets texts. Some residents have
 * none; their orders go through the same way and the screens say "no
 * mobile" so staff let them know another way.
 */
import { COMMUNITY_NAME, rooms } from '../../data';
import { dinerPerson } from '../orders';
import type { Diner, Order, Resident } from '../types';
import { hasMobile, mobileNumber, type MobileOverrides } from './phones';
import type { TextSettings } from './settings';
import { rangeOf } from './windows';

export type TextKey = 'pickupReady' | 'deliveryOut' | 'assocChange' | 'kioskCopy' | 'resvRemind' | 'resvChange' | 'resvCancel';

export type TextTag = 'first' | 'name' | 'meal' | 'venue' | 'apt' | 'time' | 'community' | 'date' | 'change' | 'when' | 'items' | 'day';

/** What each placeholder stands for, as Back Office lists them. */
export const TEXT_TAG_LABELS: Record<TextTag, string> = {
  first: 'First name',
  name: 'Full name',
  meal: 'Meal',
  venue: 'Venue',
  apt: 'Apartment',
  time: 'Ready time',
  community: 'Community',
  date: 'Day',
  day: 'Day',
  change: 'What changed',
  when: 'When and where',
  items: 'What they ordered',
};

export interface TextDefinition {
  key: TextKey;
  title: string;
  /** When it goes, in plain words. */
  when: string;
  /** Standard wording. */
  body: string;
  tags: TextTag[];
}

export const TEXT_DEFINITIONS: readonly TextDefinition[] = [
  {
    key: 'pickupReady',
    title: 'Pick up is ready',
    when: 'The only text a pick up gets. Goes once, when Expo or the to-go server has packed the order and set it out, not when the cook bumps it. Nothing is texted when it is picked up.',
    body: 'Hi {first}, your {meal} from {venue} is ready for you to come get.',
    tags: ['first', 'name', 'meal', 'venue', 'time', 'community'],
  },
  {
    key: 'deliveryOut',
    title: 'Delivery is on its way',
    when: 'The only text a delivery gets. Goes once, when the runner leaves with it. There is no ready text and no delivered text.',
    body: 'Hi {first}, your {meal} is on its way to Apt {apt}.',
    tags: ['first', 'name', 'meal', 'apt', 'venue', 'community'],
  },
  {
    key: 'assocChange',
    title: 'Associate meal changed',
    when: 'Goes to the associate when a manager changes their meal.',
    body: 'Hi {first}, your associate meal for {date} was changed: {change}',
    tags: ['first', 'name', 'date', 'change', 'community'],
  },
  {
    key: 'kioskCopy',
    title: 'Kiosk order copy',
    when: 'Goes as soon as a resident places an order at the lobby kiosk, if they have a mobile and leave Text me a copy on. Lists what they ordered, with their build-your-own choices.',
    body: '{community} Dining: your {meal} order for {when}.\n{items}',
    tags: ['first', 'name', 'meal', 'venue', 'when', 'items', 'apt', 'community'],
  },
  {
    key: 'resvRemind',
    title: 'Reservation reminder',
    when: 'Goes an hour before a dining room reservation when the host leaves Text a reminder on, one text to each resident and guest on it with a mobile on file.',
    body: 'Hi {first}, a reminder of your {meal} reservation at {venue} today at {time}. See you then!',
    tags: ['first', 'name', 'meal', 'venue', 'time', 'community'],
  },
  {
    key: 'resvChange',
    title: 'Reservation changed',
    when: 'Goes when the host moves a reservation that has Text a reminder on, to each resident and guest on it with a mobile on file.',
    body: 'Hi {first}, your {meal} reservation at {venue} is now {day} at {time}.',
    tags: ['first', 'name', 'meal', 'venue', 'day', 'time', 'community'],
  },
  {
    key: 'resvCancel',
    title: 'Reservation cancelled',
    when: 'Goes when the host cancels a reservation that has Text a reminder on, to each resident and guest on it with a mobile on file.',
    body: 'Hi {first}, your {meal} reservation at {venue} {day} at {time} has been cancelled. Call the dining room to rebook.',
    tags: ['first', 'name', 'meal', 'venue', 'day', 'time', 'community'],
  },
];

const definition = (k: TextKey) => TEXT_DEFINITIONS.find((d) => d.key === k)!;

/** The settings a text decision needs: per-text switches and wording, and mobile overrides. */
export interface TextContext {
  texts: TextSettings;
  mobile: MobileOverrides;
}

/** Whether a text is switched on (every text is on until Back Office turns it off). */
export function textOn(texts: TextSettings, k: TextKey): boolean {
  return texts[k]?.on !== false;
}

/** The community's wording for a text, or the standard wording (a blank wording never sends: the standard is used). */
export function textBody(texts: TextSettings, k: TextKey): string {
  const own = texts[k]?.body;
  return typeof own === 'string' && own.trim() ? own : definition(k).body;
}

/** Fill {placeholders}; one with no value stays as written so a mistake shows. */
export function fillText(body: string, values: Partial<Record<TextTag, string>>): string {
  return String(body || '').replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = values[k as TextTag];
    return v != null && v !== '' ? v : m;
  });
}

/** How many texts a message goes as: one up to 160 characters, then 153-character parts. */
export function smsParts(text: string): number {
  return text.length > 160 ? Math.ceil(text.length / 153) : 1;
}

/** The first resident on the order with a mobile, who gets the order's texts. */
export function textRecipient(o: Order | null | undefined, mobile: MobileOverrides): Diner | null {
  return o?.diners.find((d) => d.kind === 'resident' && d.refId && hasMobile(mobile, d.refId)) ?? null;
}

export interface TextDecision {
  sent: boolean;
  /** Why nothing is texted: "no text" (switched off) or "no mobile". */
  why: '' | 'no text' | 'no mobile';
  to?: Diner;
}

/** Whether this order's text of this kind goes out, and to whom. */
export function textFor(o: Order, k: TextKey, ctx: TextContext): TextDecision {
  if (!textOn(ctx.texts, k)) return { sent: false, why: 'no text' };
  if (o.assoc) return { sent: true, why: '' };
  const to = textRecipient(o, ctx.mobile);
  return to ? { sent: true, why: '', to } : { sent: false, why: 'no mobile' };
}

/** The text a pick up or delivery gets when it is handed on. */
export function queueTextKey(o: Pick<Order, 'queueType'>): 'pickupReady' | 'deliveryOut' {
  return o.queueType === 'delivery' ? 'deliveryOut' : 'pickupReady';
}

/** A resident order with nobody to text: show "No mobile". */
export function lacksMobile(o: Order, mobile: MobileOverrides): boolean {
  return o.diners.some((d) => d.kind === 'resident') && !textRecipient(o, mobile);
}

const venueName = (room: string) => rooms[room]?.name || 'the dining room';

/** The message an order's text would carry. */
export function textMessage(o: Order, k: TextKey, ctx: TextContext): string {
  const d = textRecipient(o, ctx.mobile) ?? o.diners[0];
  const p = d ? (dinerPerson(d) as Resident | undefined) : undefined;
  const name = p?.name ?? '';
  return fillText(textBody(ctx.texts, k), {
    first: name.split(' ')[0],
    name,
    meal: String(o.meal || 'order').toLowerCase(),
    venue: venueName(o.room),
    apt: p?.apt ?? '',
    time: o.readyAt ? rangeOf(o.readyAt) : '',
    community: COMMUNITY_NAME,
  });
}

/** The phone a queue order's text goes to, or "". */
export function textNumber(o: Order, ctx: TextContext): string {
  const d = textRecipient(o, ctx.mobile);
  return d ? mobileNumber(ctx.mobile, d.refId) : '';
}
