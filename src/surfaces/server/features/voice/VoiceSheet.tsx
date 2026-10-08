import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Keyboard, Mic, Square } from 'lucide-react';
import { getResident } from '../../../../data';
import { tableName } from '../../../../domain/orders';
import type { Order } from '../../../../domain/types';
import { now } from '../../../../lib/clock';
import { useDiningHistory, useDiningOrders } from '../../../../store/dining';
import { Avatar, Button, Chip, Sheet, TextArea, cx, useNow } from '../../../../ui';
import { matchDish, sentimentOf, SENTIMENT_LABEL } from '../shared/feedback';
import { NOTE_KINDS } from '../shared/noteKinds';
import { tableResidents } from '../shared/tablePeople';
import { saveHeard, undoSaved, type SavedNote } from './saveHeard';
import { useSpeech } from './useSpeech';
import { exampleFor } from './voiceExamples';
import { sortTranscript } from './voiceSorter';
import s from './VoiceSheet.module.css';

const mmss = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

/**
 * Voice notes for one table: talk about anyone at the table in one go.
 * What is heard is sorted and saved at once (little things, observations
 * for the care team, dining preferences, feedback for the kitchen); review
 * is undo, never a gate, because the server is walking.
 */
export function VoiceSheet({ order, onClose, onBack }: { order: Order; onClose: () => void; onBack?: () => void }) {
  const orders = useDiningOrders();
  const history = useDiningHistory();
  const residents = useMemo(() => tableResidents(order), [order]);
  const speech = useSpeech();
  const [said, setSaid] = useState('');
  const [rows, setRows] = useState<SavedNote[] | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const stopping = useRef(false);
  const t = useNow(500);

  const examples = useMemo(() => {
    const one = residents.map((r) => ({ label: r.name.split(' ')[0], text: exampleFor(r, order) }));
    if (one.length < 2) return one;
    return [{ label: one.length > 3 ? 'Three at once' : 'Everyone at once', text: one.slice(0, 3).map((x) => x.text).join(' ') }, ...one];
  }, [residents, order]);

  const hear = (text: string) => {
    const heard = sortTranscript(text, residents);
    if (!heard.length) return;
    setSaid(text.trim());
    setRows(saveHeard(heard, { by: order.server, table: tableName(order), oid: order.id }));
    setTyping(false);
    setDraft('');
  };

  const hearRef = useRef(hear);
  hearRef.current = hear;
  // Once the recogniser has really stopped (the last words arrive just
  // before it ends), sort and save what it heard.
  useEffect(() => {
    if (stopping.current && !speech.listening) {
      stopping.current = false;
      setStartedAt(null);
      if (speech.transcript.trim()) hearRef.current(speech.transcript);
    }
  }, [speech.listening, speech.transcript]);

  const mic = () => {
    if (speech.listening) {
      stopping.current = true;
      speech.stop();
    } else {
      setStartedAt(now());
      speech.start();
    }
  };

  const undo = (i: number) => {
    if (!rows || rows[i].undone) return;
    undoSaved(rows[i]);
    setRows(rows.map((r, j) => (j === i ? { ...r, undone: true } : r)));
  };
  const discard = () => {
    rows
      ?.slice()
      .reverse()
      .forEach((r) => !r.undone && undoSaved(r));
    setRows(null);
    setSaid('');
    speech.reset();
  };

  const checks = useMemo(() => [order, ...orders, ...history], [order, orders, history]);
  const live = rows?.filter((r) => !r.undone).length ?? 0;
  const secs = startedAt ? Math.max(0, Math.floor((t - startedAt) / 1000)) : 0;
  const canListen = speech.supported && !speech.error;

  return (
    <Sheet
      open
      onClose={onClose}
      side="bottom"
      className={s.sheet}
      title={
        <span className={s.titleRow}>
          {onBack && (
            <Button variant="secondary" size="sm" icon={<ChevronLeft size={16} />} onClick={onBack}>
              Tables
            </Button>
          )}
          {rows ? 'Heard and saved' : 'Say it and go'}
        </span>
      }
      subtitle={
        <span className={s.subRow}>
          <span>{tableName(order)}</span>
          <span className={s.faces} aria-hidden>
            {residents.slice(0, 6).map((r) => (
              <Avatar key={r.id} person={r} size={30} className={s.face} />
            ))}
          </span>
        </span>
      }
    >

      {!residents.length && <p className={s.none}>Add a resident to this check to leave a voice note about them.</p>}

      {residents.length > 0 && !rows && (
        <>
          <p className={s.intro}>
            Talk about anyone at the table, all in one go. It keeps the little things you learned, passes anything you noticed to the care
            team, updates dining preferences, and sends comments on the food to the culinary team. It saves as soon as you stop.
          </p>
          {canListen && !typing && (
            <>
              <div className={s.micWrap}>
                <button
                  type="button"
                  className={cx(s.mic, speech.listening && s.micOn)}
                  onClick={mic}
                  aria-label={speech.listening ? 'Stop recording' : 'Start recording'}
                >
                  {speech.listening ? <Square size={30} fill="currentColor" /> : <Mic size={40} />}
                </button>
              </div>
              <p className={cx(s.micHint, speech.listening && s.micHintOn)} role="status">
                {speech.listening ? `Listening ${mmss(secs)} · tap to stop` : 'Tap to start, tap again when you are done. It never listens on its own.'}
              </p>
              {speech.listening && speech.transcript && <p className={s.live}>“{speech.transcript}”</p>}
            </>
          )}
          {(!canListen || typing) && (
            <div className={s.typeBox}>
              {!speech.supported && <p className={s.notice}>Voice isn't available in this browser. Type what you heard instead.</p>}
              {speech.error && <p className={s.notice}>{speech.error}</p>}
              <TextArea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`e.g. ${residents[0].name.split(' ')[0]}'s grandson visits on Sunday. She'd like her dressing on the side.`}
                aria-label="What you heard"
                data-autofocus
              />
              <div className={s.typeActions}>
                {canListen && (
                  <Button variant="ghost" onClick={() => setTyping(false)}>
                    Use the mic
                  </Button>
                )}
                <Button variant="primary" disabled={!draft.trim()} onClick={() => hear(draft)}>
                  Save
                </Button>
              </div>
            </div>
          )}
          {canListen && !typing && !speech.listening && (
            <div className={s.center}>
              <Button variant="ghost" icon={<Keyboard size={16} />} onClick={() => setTyping(true)}>
                Type instead
              </Button>
            </div>
          )}
          {!speech.listening && (
            <>
              <h3 className={s.cap}>Try an example</h3>
              <div className={s.examples}>
                {examples.map((x) => (
                  <button key={x.label} type="button" className={s.example} onClick={() => hear(x.text)}>
                    <span className={s.exampleLabel}>{x.label}</span>
                    <span className={s.exampleText}>“{x.text}”</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {rows && (
        <>
          <h3 className={s.cap}>You said</h3>
          <p className={s.said}>“{said}”</p>
          <div className={s.countRow}>
            <span className={s.cap}>{live === 1 ? '1 thing, saved' : `${live} things, all saved`}</span>
            <span className={s.countHint}>undo anything that is wrong</span>
          </div>
          <ul className={s.rows}>
            {rows.map((r, i) => {
              const k = NOTE_KINDS[r.kind];
              const res = getResident(r.residentId);
              const dish = r.kind === 'fb' ? matchDish(r.text, r.residentId, checks) : null;
              const sent = r.kind === 'fb' ? sentimentOf(r.text) : null;
              return (
                <li key={r.noteId} className={cx(s.row, r.undone && s.undone)}>
                  <Avatar person={res} size={38} />
                  <div className={s.rowBody}>
                    <div className={s.rowHead}>
                      <Chip tone={k.tone} size="xs" className={s.kind}>
                        {k.label}
                      </Chip>
                      <span className={s.rowName}>{res?.name}</span>
                    </div>
                    <div className={s.rowText}>{r.text}</div>
                    {sent && !r.undone && (
                      <div className={s.about}>
                        <Chip size="xs" tone={sent === 'pos' ? 'success' : sent === 'neg' ? 'danger' : 'neutral'}>
                          {SENTIMENT_LABEL[sent]}
                        </Chip>
                        {dish ? (
                          <span>
                            About: <b>{dish.name}</b>
                            <span className={s.how}>
                              {dish.how === 'check' ? ' · on their check' : dish.how === 'menu' ? " · on today's menu" : ' · their only entrée'}
                            </span>
                          </span>
                        ) : (
                          <span className={s.how}>Not about a particular dish</span>
                        )}
                      </div>
                    )}
                    <div className={s.rowStatus}>{r.undone ? 'Undone' : r.kind === 'pref' ? `Now: ${r.after}` : k.saved}</div>
                  </div>
                  {!r.undone && (
                    <Button size="md" onClick={() => undo(i)}>
                      Undo
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className={s.footer}>
            <Button variant="softDanger" size="lg" className={s.discard} onClick={discard}>
              Discard + try again
            </Button>
            <Button variant="primary" size="lg" className={s.done} onClick={onClose}>
              Done
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
