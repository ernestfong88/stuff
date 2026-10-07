import { Sparkles } from 'lucide-react';
import type { Resident } from '../../../../domain/types';
import { useResidentNotes } from '../../../../store/notes';
import { conversationStarters, useResidentStory } from '../../../../store/residentStories';
import { littleThings } from './littleThings';
import s from './GoodToKnow.module.css';

/**
 * Good to know, for the check when a server seats a resident: up to three
 * little things going on in their life and one question to ask tonight.
 */
export function GoodToKnow({ resident }: { resident: Resident }) {
  const notes = useResidentNotes('know', resident.id);
  const story = useResidentStory(resident.id);
  const things = littleThings(notes, story.goodToKnow).slice(0, 3);
  const question = conversationStarters(story, resident)[0];
  if (!things.length && !question) return null;
  return (
    <div className={s.box}>
      <div className={s.cap}>
        <Sparkles size={12} aria-hidden /> Good to know
      </div>
      {things.map((t) => (
        <div key={t.text} className={s.thing}>
          {t.fresh && <span className={s.new}>New</span>}
          {t.text}
        </div>
      ))}
      {question && <div className={s.question}>“{question}”</div>}
    </div>
  );
}
