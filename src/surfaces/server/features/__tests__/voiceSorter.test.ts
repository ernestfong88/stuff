import { describe, expect, it } from 'vitest';
import { getResident } from '../../../../data';
import type { Resident } from '../../../../domain/types';
import { writtenExamples } from '../voice/voiceExamples';
import { noteKind, sortTranscript, splitSentences, tidyNote } from '../voice/voiceSorter';

describe('voice sorter', () => {
  it('sorts every written example the way it was written', () => {
    for (const [rid, sample] of writtenExamples()) {
      const r = getResident(rid) as Resident;
      const heard = sortTranscript(sample.said, [r]);
      expect(heard.map((h) => h.kind), rid).toEqual(sample.heard.map((h) => h[0]));
      expect(heard.every((h) => h.residentId === rid)).toBe(true);
    }
  });

  it('attributes sentences by first name, then to whoever was talked about last', () => {
    const marty = getResident('r1') as Resident;
    const cathie = getResident('r1b') as Resident;
    const heard = sortTranscript('Cathie is off to Tucson next week. She wants dressing on the side. Marty loved the soup. He seemed tired.', [
      marty,
      cathie,
    ]);
    expect(heard.map((h) => [h.residentId, h.kind])).toEqual([
      ['r1b', 'know'],
      ['r1b', 'pref'],
      ['r1', 'fb'],
      ['r1', 'obs'],
    ]);
  });

  it('tidies notes so they read well under the resident', () => {
    expect(tidyNote('And he wants decaf with dinner from now on.', 'pref', 'Marty')).toBe('Decaf with dinner.');
    expect(tidyNote("She'd like her dressing on the side.", 'pref', 'Cathie')).toBe('Dressing on the side.');
    expect(tidyNote('He did say the soup was too salty.', 'fb', 'Tom')).toBe('Said the soup was too salty.');
    expect(tidyNote("Marty says his grandson made the dean's list.", 'know', 'Marty')).toBe("His grandson made the dean's list.");
    expect(tidyNote('needed help cutting his chicken', 'obs', 'Frank')).toBe('Needed help cutting his chicken.');
  });

  it('keeps observations ahead of food comments', () => {
    expect(noteKind('She left most of her chicken, said it was hard to chew.')).toBe('obs');
    expect(noteKind('She thought the flounder was a bit dry.')).toBe('fb');
  });

  it('splits sentences and ignores empty ones', () => {
    expect(splitSentences('One.  Two! Three? ...')).toEqual(['One.', 'Two!', 'Three?']);
  });

  it('saves nothing for a table with no residents', () => {
    expect(sortTranscript('Loved the soup.', [])).toEqual([]);
  });
});
