import { useState } from 'react';
import { Mic } from 'lucide-react';
import { useNow } from '../../ui';
import { addPrepNote, prepNotes, removePrepNote, useProduction, type PrepMeal } from '../../store/production';
import { noteWhen } from './logic';
import { useSpeechNote } from './useSpeechNote';
import s from './PrepNotes.module.css';

interface PrepNotesProps {
  venueId: string;
  iso: string;
  meal: PrepMeal;
  dish: string;
  /** Who signs notes made on this tablet. */
  cook: string;
}

/**
 * Progress notes on a special, said out loud or typed. A note belongs to the
 * venue, service date, meal and dish, so one left tonight on tomorrow's
 * special is waiting for the morning cook.
 */
export function PrepNotes({ venueId, iso, meal, dish, cook }: PrepNotesProps) {
  const state = useProduction();
  const nowMs = useNow(30_000);
  const notes = prepNotes(state, venueId, iso, meal, dish, nowMs);
  const speech = useSpeechNote(`${venueId}|${iso}|${meal}|${dish}`);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? notes : notes.slice(0, 2);
  const canSave = speech.text.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    addPrepNote(venueId, iso, meal, dish, { text: speech.text, voice: speech.stage === 'review' }, cook);
    setShowAll(false);
    speech.close();
  };

  return (
    <div className={s.notes}>
      {speech.stage === 'idle' && (
        <>
          {speech.message && (
            <p role="status" className={s.message}>
              {speech.message}
            </p>
          )}
          {speech.supported ? (
            <div className={s.row}>
              <button className={s.mic} onClick={speech.listen} aria-label={`Add a voice note to ${dish}`}>
                <span className={s.micDot}>
                  <Mic size={22} strokeWidth={2.4} aria-hidden />
                </span>
                Add a voice note
              </button>
              <button className={s.secondary} onClick={speech.typeInstead}>
                Type
              </button>
            </div>
          ) : (
            <>
              <p className={s.hint}>Voice notes need Chrome or Edge. In this browser, type the note instead.</p>
              <button className={s.secondaryWide} onClick={speech.typeInstead}>
                Type a progress note
              </button>
            </>
          )}
        </>
      )}

      {speech.stage === 'listen' && (
        <div className={s.live}>
          <div className={s.liveHead}>
            <span className={s.pulse} aria-hidden />
            Listening
          </div>
          <div className={s.transcript} aria-live="polite">
            {speech.text}
            {speech.interim && <span className={s.interim}>{(speech.text ? ' ' : '') + speech.interim}</span>}
            {!speech.text && !speech.interim && <span className={s.placeholder}>Start talking. Your words show up here as you go.</span>}
          </div>
          <div className={s.row}>
            <button className={s.stop} onClick={speech.stop}>
              Done talking
            </button>
            <button className={s.secondary} onClick={speech.close}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {(speech.stage === 'review' || speech.stage === 'type') && (
        <div>
          {speech.message && (
            <p role="status" className={s.message}>
              {speech.message}
            </p>
          )}
          <textarea
            className={s.box}
            value={speech.text}
            onChange={(e) => speech.setText(e.target.value)}
            rows={3}
            maxLength={400}
            autoFocus={speech.stage === 'type'}
            aria-label={`Progress note for ${dish}`}
            placeholder="Type the note, e.g. what's done and what's left"
          />
          <div className={s.row}>
            <button className={s.save} onClick={save} disabled={!canSave}>
              Save note
            </button>
            {speech.stage === 'review' && speech.supported && (
              <button className={s.secondary} onClick={speech.listen}>
                Redo
              </button>
            )}
            <button className={s.secondary} onClick={speech.close}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className={s.list}>
          <div className={s.listHead}>Progress notes · {notes.length}</div>
          {shown.map((n) => (
            <div key={n.id} className={s.note}>
              <div className={s.noteText}>{n.text}</div>
              <div className={s.noteMeta}>
                {n.voice && <Mic size={12} strokeWidth={2.4} aria-label="Voice note" />}
                <span className={s.noteWho}>
                  {n.by} · {noteWhen(n.at, nowMs)}
                </span>
                {n.by === cook && (
                  <button className={s.remove} onClick={() => removePrepNote(venueId, iso, meal, dish, n.id)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          {notes.length > 2 && (
            <button className={s.more} onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : `Show all ${notes.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
