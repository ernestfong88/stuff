import type { ResidentNoteKind } from '../../../../domain/types';
import { addNote, dropNote } from '../../../../store/notes';
import { residentPref, residentPrefsStore, updateResidentPref } from '../../../../store/residentPrefs';
import type { HeardNote } from './voiceSorter';

/** A note saved from the voice sheet, with what undo needs. */
export interface SavedNote {
  kind: ResidentNoteKind;
  residentId: string;
  text: string;
  noteId: string;
  /** Preferences only: the text before and after. */
  before?: string;
  after?: string;
  undone?: boolean;
}

/** "Tea, no sugar." + "Decaf with dinner." → "Tea, no sugar. Decaf with dinner." */
export function appendPreference(current: string, addition: string): string {
  return current ? current.replace(/[.\s]*$/, '. ') + addition : addition;
}

/**
 * Take a preference note back out of the resident's preference text (when
 * it is deleted in Shift Review), or replace it with a corrected version.
 */
export function withoutPreference(current: string, text: string, replacement = ''): string {
  if (!current.includes(text)) return current;
  if (replacement) return current.replace(text, replacement);
  return current
    .replace(text, '')
    .replace(/\s*\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[.\s]+|\s+$/g, '');
}

/**
 * Save everything heard at once. Preferences are added to the resident's
 * dining preference straight away, the rest becomes notes.
 */
export function saveHeard(heard: HeardNote[], meta: { by: string; table: string; oid: string }): SavedNote[] {
  const prefs: Record<string, string> = {};
  return heard.map((h) => {
    if (h.kind !== 'pref') return { ...h, noteId: addNote(h.kind, h.residentId, h.text, meta) };
    const before = prefs[h.residentId] ?? residentPref(residentPrefsStore.get(), h.residentId);
    const after = appendPreference(before, h.text);
    prefs[h.residentId] = after;
    updateResidentPref(h.residentId, after);
    return { ...h, noteId: addNote('pref', h.residentId, h.text, meta), before, after };
  });
}

/** Undo one saved note (and its preference change). */
export function undoSaved(n: SavedNote): void {
  if (n.kind === 'pref' && n.before != null) updateResidentPref(n.residentId, n.before);
  dropNote(n.noteId);
}
