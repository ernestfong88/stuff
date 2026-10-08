/**
 * Resident notes from servers (voice notes in the prototype).
 *
 * A server talks about anyone at a table in one breath; each thing heard is
 * sorted into little things to know, an observation for the care team, a
 * dining preference change, or dining feedback for the culinary team, and
 * saved at once. Review is undo, never a gate, because the server is
 * walking. Observations never reach "Good to know": that stays hospitality
 * only. Every note is one point for the server who added it (Shift Review).
 */
import { seedResidentNotes } from '../data';
import type { ResidentNote, ResidentNoteKind } from '../domain/types';
import { now } from '../lib/clock';
import { uid } from '../lib/id';
import { createSharedStore, useShared } from '../lib/sharedStore';

/** Every note, newest added first. */
export const notesStore = createSharedStore<ResidentNote[]>(seedResidentNotes, {
  persistKey: 'kisco.notes.v1',
  channel: 'kisco-notes',
});

/** Notes of one kind about one resident, newest added first. */
export function notesFor(notes: ResidentNote[], kind: ResidentNoteKind, residentId: string): ResidentNote[] {
  return notes.filter((n) => n.kind === kind && n.rid === residentId);
}

/** Save a note; returns its id (for undo). `meta` carries by, table and the like. */
export function addNote(
  kind: ResidentNoteKind,
  residentId: string,
  text: string,
  meta?: Partial<Omit<ResidentNote, 'id' | 'kind' | 'rid' | 'text'>>,
): string {
  const note: ResidentNote = { id: uid('n'), kind, rid: residentId, text, at: now(), ...meta };
  notesStore.set((list) => [note, ...list]);
  return note.id;
}

/** Remove a note (undo). */
export function dropNote(noteId: string): void {
  notesStore.set((list) => list.filter((n) => n.id !== noteId));
}

/** Correct a note's text. */
export function editNote(noteId: string, text: string): void {
  notesStore.set((list) => list.map((n) => (n.id === noteId ? { ...n, text, edited: true } : n)));
}

/** Every note, newest added first. */
export function useNotes(): ResidentNote[] {
  return useShared(notesStore);
}

/** One resident's notes of one kind. */
export function useResidentNotes(kind: ResidentNoteKind, residentId: string): ResidentNote[] {
  const notes = useShared(notesStore);
  return notesFor(notes, kind, residentId);
}
