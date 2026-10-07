/**
 * Who a reservation text can reach, and the texts themselves.
 *
 * Every resident and every guest on file with a mobile gets their own text;
 * a typed-in guest has no number to text. All numbers are made-up 555
 * numbers. The demo has no text provider, so a sent text is kept in a
 * simulated outbox; a real provider replaces sendText() with a call to the
 * community's own server, which holds the provider account.
 */
import { COMMUNITY_NAME, getResident, rooms } from '../../../data';
import { now } from '../../../lib/clock';
import { createSharedStore } from '../../../lib/sharedStore';
import { getSetting } from '../../../store/serviceConfig';

export interface GuestOnFile {
  id: string;
  name: string;
  rel: string;
  /** Resident they visit. */
  host: string;
  /** Mobile number, when they gave one. */
  mobile?: string;
  /** Home landline only (cannot get texts). */
  home?: string;
}

const GUESTS: Array<[id: string, name: string, rel: string, host: string, phone: 'm' | 'h' | '']> = [
  ['g1', 'Anne Vanholder', 'Daughter', 'r8', 'm'],
  ['g2', 'Peter Vanholder', 'Son', 'r8', 'm'],
  ['g3', 'Claire Vanholder', 'Daughter-in-law', 'r8', 'h'],
  ['g4', 'Sophie Vanholder', 'Great-granddaughter', 'r8', ''],
  ['g5', 'Paul Whitfield', 'Son', 'r2', 'm'],
  ['g6', 'Kim Whitfield', 'Daughter-in-law', 'r2', 'm'],
  ['g7', 'Jim Carver', 'Friend', 'r3', 'm'],
  ['g8', 'Patricia Whitman', 'Daughter', 'r21', 'm'],
  ['g9', 'Mark Whitman', 'Son', 'r21', 'h'],
  ['g10', 'James Bellamy', 'Son', 'r13', 'm'],
  ['g11', 'Rita Bellamy', 'Daughter-in-law', 'r13', 'm'],
  ['g12', 'Ellen Hale', 'Niece', 'r22', 'm'],
  ['g13', 'Kevin Flynn', 'Son', 'r16', 'm'],
  ['g14', 'Emma Flynn', 'Granddaughter', 'r16', 'm'],
  ['g15', 'Mary Whitaker', 'Sister', 'r18', 'm'],
  ['g16', 'David Martin', 'Son', 'r1', 'm'],
  ['g17', 'Susan Reyes', 'Daughter', 'r1', 'm'],
  ['g18', 'Tyler Martin', 'Grandson', 'r1', ''],
  ['g19', 'Amy Delgado', 'Daughter', 'r4', 'm'],
];

/** Guests the community already has on file, each tied to the resident they visit. */
export const GUESTS_ON_FILE: GuestOnFile[] = GUESTS.map(([id, name, rel, host, phone], i) => {
  const num = '555555' + String(301 + i).padStart(4, '0');
  return { id, name, rel, host, ...(phone === 'm' ? { mobile: num } : phone === 'h' ? { home: num } : {}) };
});

export function guestOnFile(id: string | null | undefined): GuestOnFile | null {
  return (id && GUESTS_ON_FILE.find((g) => g.id === id)) || null;
}

/**
 * Residents' phones. Rose (412) and Nora (B110) have a landline only, Joan
 * (224) and Dorothy (12B) no phone, so each path can be tried.
 */
const RESIDENT_IDS = ['r1', 'r1b', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15', 'r16', 'r17', 'r18', 'r19', 'r20', 'r21', 'r22', 'r23', 'r24'];
const NO_PHONE = new Set(['r6', 'r22']);
const HOME_ONLY = new Set(['r4', 'r24']);

function residentPhone(rid: string): { mobile?: string; home?: string } {
  const i = RESIDENT_IDS.indexOf(rid);
  if (i < 0 || NO_PHONE.has(rid)) return {};
  const num = '555555' + String(101 + i).padStart(4, '0');
  return HOME_ONLY.has(rid) ? { home: num } : { mobile: num };
}

/** Back Office can mark a resident as having (or not having) a mobile. */
export function hasMobile(rid: string): boolean {
  const saved = getSetting<Record<string, unknown> | undefined>('mobile')?.[rid];
  return saved != null ? !!saved : !!residentPhone(rid).mobile;
}

export function residentMobile(rid: string): string {
  return hasMobile(rid) ? (residentPhone(rid).mobile ?? '') : '';
}

export interface TextPerson {
  rid?: string;
  gid?: string;
  guest?: string;
}

export interface Recipients {
  to: Array<{ name: string; mobile: string }>;
  skip: Array<{ name: string; why?: string; typed?: boolean }>;
}

function nameOf(p: TextPerson): string {
  if (p.rid) return getResident(p.rid)?.name ?? 'Resident';
  return p.guest || guestOnFile(p.gid)?.name || 'Guest';
}

/** Who a reservation text reaches, and who it cannot. */
export function recipients(people: TextPerson[]): Recipients {
  const out: Recipients = { to: [], skip: [] };
  for (const p of people) {
    const name = nameOf(p);
    if (p.rid) {
      const m = residentMobile(p.rid);
      if (m) out.to.push({ name, mobile: m });
      else out.skip.push({ name, why: residentPhone(p.rid).home ? 'home phone only' : 'no mobile on file' });
      continue;
    }
    const g = guestOnFile(p.gid);
    if (!g) out.skip.push({ name, typed: true });
    else if (g.mobile) out.to.push({ name, mobile: g.mobile });
    else out.skip.push({ name, why: g.home ? 'home phone only' : 'no mobile on file' });
  }
  return out;
}

function and(list: string[]): string {
  return list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** "Texts Mildred, Anne and Peter (3). No mobile for: Joan (no mobile on file)." */
export function recipientsLine(people: TextPerson[]): string {
  const { to, skip } = recipients(people);
  const all = people.map(nameOf);
  const short = (n: string) => {
    const first = n.split(' ')[0];
    return all.filter((x) => x.split(' ')[0] === first).length > 1 ? n : first;
  };
  return (
    (to.length ? `Texts ${and(to.map((x) => short(x.name)))} (${to.length}).` : 'No one here has a mobile on file.') +
    (skip.length ? ` No mobile for: ${skip.map((x) => (x.typed ? `Guest “${x.name}”` : `${short(x.name)} (${x.why})`)).join(', ')}.` : '')
  );
}

// ─── Texts ───────────────────────────────────────────────────────────────

export type ResvTextKind = 'resvRemind' | 'resvChange' | 'resvCancel';

/** Standard wording; each community can rewrite it in Back Office, Text Messages. */
const DEFAULT_BODY: Record<ResvTextKind, string> = {
  resvRemind: 'Hi {first}, a reminder of your {meal} reservation at {venue} today at {time}. See you then!',
  resvChange: 'Hi {first}, your {meal} reservation at {venue} is now {day} at {time}.',
  resvCancel: 'Hi {first}, your {meal} reservation at {venue} {day} at {time} has been cancelled. Call the dining room to rebook.',
};

interface SavedText {
  on?: boolean;
  body?: string;
}

export function textOn(kind: ResvTextKind): boolean {
  return getSetting<SavedText | undefined>(`texts.${kind}`)?.on !== false;
}

function textBody(kind: ResvTextKind): string {
  const saved = getSetting<SavedText | undefined>(`texts.${kind}`)?.body;
  return typeof saved === 'string' ? saved : DEFAULT_BODY[kind];
}

/** Fill {placeholders}; an unknown or empty one is left as written. */
export function fillText(body: string, values: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (m, k: string) => (values[k] ? values[k] : m));
}

export interface SentText {
  to: string;
  name: string;
  body: string;
  kind: string;
  /** Reservation id. */
  ref: string;
  at: number;
  status: 'simulated';
}

/** The simulated outbox, newest first (Back Office Text Messages can list it). */
export const textOutbox = createSharedStore<SentText[]>([], { persistKey: 'kisco_sms_outbox', channel: 'kisco-sms-outbox' });

/** Text everyone on a reservation who has a mobile. Returns how many were texted. */
export function textParty(
  r: { id: string; room: string; meal: string; time: string; day: string; people: TextPerson[] },
  kind: ResvTextKind,
): number {
  if (!textOn(kind)) return 0;
  const { to } = recipients(r.people);
  const values = { meal: r.meal.toLowerCase(), venue: rooms[r.room]?.name ?? 'the dining room', time: r.time, day: r.day, community: COMMUNITY_NAME };
  const at = now();
  const sent: SentText[] = to.map((x) => ({
    to: x.mobile,
    name: x.name,
    kind,
    ref: r.id,
    at,
    status: 'simulated',
    body: fillText(textBody(kind), { ...values, first: x.name.split(' ')[0], name: x.name }),
  }));
  if (sent.length) textOutbox.set((list) => [...sent, ...list].slice(0, 50));
  return sent.length;
}

/** ". Texted 3 people" for a toast, or nothing. */
export function textedNote(n: number): string {
  return n ? `. Texted ${n === 1 ? '1 person' : `${n} people`}` : '';
}
