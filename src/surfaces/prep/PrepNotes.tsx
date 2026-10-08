import { useState, type ReactNode } from 'react';
import { Mic, Pencil } from 'lucide-react';
import { useConfirm, useNow } from '../../ui';
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
  /** The card's main action (Complete), on the same row as the note buttons. */
  lead?: ReactNode;
}

/**
 * Progress notes on a special, said out loud or typed. A note belongs to the
 * venue, service date, meal and dish, so one left tonight on tomorrow's
 * special is waiting for the morning cook.
 */
export function PrepNotes({ venueId, iso, meal, dish, cook, lead }: PrepNotesProps) {
  const state = useProduction();
  const nowMs = useNow(30_000);
  const notes = prepNotes(state, venueId, iso, meal, dish, nowMs);
  const speech = useSpeechNote(`${venueId}|${iso}|${meal}|${dish}`);
  const [showAll, setShowAll] = useState(false);
  const [ask, confirmDialog] = useConfirm();
  const shown = showAll ? notes : notes.slice(0, 2);
  const canSave = speech.text.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    addPrepNote(venueId, iso, meal, dish, { text: speech.text, voice: speech.stage === 'review' }, cook);
    setShowAll(false);
    speech.close();
  };

  const remove = async (id: string, text: string) => {
    const ok = await ask({
      title: 'Remove this note?',
      message: (
        <>
          “{text.length > 120 ? text.slice(0, 117) + '...' : text}”
          <br />
          Once removed, the next cook won&apos;t see it.
        </>
      ),
      confirmLabel: 'Remove note',
      tone: 'danger',
    });
    if (ok) removePrepNote(venueId, iso, meal, dish, id);
  };

  return (
    <div className={s.notes}>
      {confirmDialog}
      {speech.stage === 'idle' && (
        <>
          {speech.message && (
            <p role="status" className={s.message}>
              {speech.message}
            </p>
          )}
          {/* One row: the main action, then a voice note and a typed note as compact icon buttons. */}
          <div className={s.row}>
            {lead}
            {speech.supported && (
              <button className={s.mic} onClick={speech.listen} aria-label={`Add a voice note to ${dish}`} title="Voice note">
                <Mic size={22} strokeWidth={2.4} aria-hidden />
              </button>
            )}
            <button
              className={s.type}
              onClick={speech.typeInstead}
              aria-label={`Type a note on ${dish}`}
              title={speech.supported ? 'Type a note' : 'Type a note (voice notes need Chrome or Edge)'}
            >
              <Pencil size={20} strokeWidth={2.4} aria-hidden />
            </button>
          </div>
        </>
      )}
      {speech.stage !== 'idle' && lead && <div className={s.row}>{lead}</div>}

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
                  <button className={s.remove} onClick={() => void remove(n.id, n.text)}>
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
