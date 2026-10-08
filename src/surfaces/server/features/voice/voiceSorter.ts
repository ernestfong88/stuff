/**
 * Sort what a server said about a table into notes.
 *
 * A server talks about anyone at the table in one breath. Each sentence is
 * matched to a resident (by first name, else whoever was talked about last)
 * and sorted into one of four kinds:
 *
 * - obs: something they noticed, for the care team (trouble hearing,
 *   needed help cutting, seemed tired). Checked first, because a remark
 *   about the food can also be a sign worth passing on ("left most of it").
 * - pref: a standing preference ("decaf from now on", "dressing on the side").
 * - fb: a comment on the food for the culinary team.
 * - know: everything else, the little things going on in their life.
 *
 * This is a plain keyword sorter so it works offline on the tablet. Review
 * is undo, never a gate, because the server is walking.
 */
import type { ResidentNoteKind } from '../../../../domain/types';

export interface HeardNote {
  kind: ResidentNoteKind;
  residentId: string;
  text: string;
}

const OBSERVATION =
  /\b(trouble|hard time|hard to (chew|hear|read|see|swallow|cut)|cough\w*|tired|barely|left most|only ate|needed help|help (cutting|with)|confus\w*|dizzy|not (very )?hungry|squint\w*|couldn'?t|could not|seemed (tired|off|down|confused|sad|unwell|quiet)|fell|forgot|short of breath|chok\w*)\b/i;
const PREFERENCE =
  /\b(wants?|would like|'d like|prefers?|from now on|likes (his|her|their)|asked for (extra|more|no|a|an)|on the side|no more|instead of|every time)\b|^no\s/i;
const FEEDBACK =
  /\b(salty|dry|dried out|cold|lukewarm|bland|tough|chewy|overcooked|undercooked|delicious|fantastic|tasty|tender|wonderful|excellent|perfect|loved|enjoyed|best thing|bring back|no flavor|too spicy|soggy|greasy)\b/i;

/** Which kind of note a sentence is. */
export function noteKind(sentence: string): ResidentNoteKind {
  if (OBSERVATION.test(sentence)) return 'obs';
  if (PREFERENCE.test(sentence)) return 'pref';
  if (FEEDBACK.test(sentence)) return 'fb';
  return 'know';
}

/** Sentences, keeping their end marks. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => /[a-z]/i.test(s));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Tidy a sentence into a note: drop the lead-in ("And", "Marty says"), and
 * for observations, preferences and feedback the subject too, so the note
 * reads "Needed help cutting his chicken." under the resident's name.
 */
export function tidyNote(sentence: string, kind: ResidentNoteKind, firstName: string): string {
  let t = sentence.trim().replace(/^(and|also|oh and|plus|so)\s+/i, '');
  const name = escape(firstName);
  t = t.replace(new RegExp(`^${name}\\s+(says|said|mentioned|told me)\\s+(that\\s+)?`, 'i'), '');
  if (kind !== 'know') {
    t = t.replace(new RegExp(`^(${name}|he|she|they)\\s+(?!'s\\b)`, 'i'), '');
    t = t.replace(/^(he|she|they)'d like\s+/i, '');
    t = t.replace(/^did say\b/i, 'said');
  }
  if (kind === 'pref') {
    t = t
      .replace(/^(would like|wants?|prefers?|likes)\s+/i, '')
      .replace(/^(his|her|their)\s+/i, '')
      .replace(/\s*,?\s*from now on/i, '');
  }
  t = capitalize(t.trim());
  return /[.!?]$/.test(t) ? t : t + '.';
}

/**
 * Turn what was said into notes for the residents at the table. Returns
 * nothing when nobody at the table is a resident.
 */
export function sortTranscript(text: string, residents: Array<{ id: string; name: string }>): HeardNote[] {
  if (!residents.length) return [];
  const firsts = residents.map((r) => ({ id: r.id, first: r.name.split(' ')[0] }));
  let current = residents[0].id;
  const out: HeardNote[] = [];
  for (const sentence of splitSentences(text)) {
    const named = firsts.find((r) => new RegExp(`\\b${escape(r.first)}('s)?\\b`, 'i').test(sentence));
    if (named) current = named.id;
    const kind = noteKind(sentence);
    const first = firsts.find((r) => r.id === current)!.first;
    out.push({ kind, residentId: current, text: tidyNote(sentence, kind, first) });
  }
  return out;
}
