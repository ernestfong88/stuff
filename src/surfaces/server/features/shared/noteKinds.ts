import type { ResidentNoteKind } from '../../../../domain/types';
import type { Tone } from '../../../../ui';

/** How each kind of resident note is labelled, coloured and confirmed. */
export const NOTE_KINDS: Record<ResidentNoteKind, { label: string; tone: Tone; saved: string; color: string }> = {
  know: { label: 'Little things', tone: 'plum', saved: 'Added to their Good to know', color: 'var(--plum)' },
  obs: { label: 'Observation', tone: 'warning', saved: 'Sent to the care team and dining manager', color: 'var(--clay-600)' },
  pref: { label: 'Dining preference', tone: 'info', saved: 'Preference updated', color: 'var(--ocean-700)' },
  fb: { label: 'Dining feedback', tone: 'success', saved: "Sent to the culinary team for today's summary", color: 'var(--flora)' },
};
