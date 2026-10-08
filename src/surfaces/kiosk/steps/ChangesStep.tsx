import { useEffect, useRef, useState } from 'react';
import { Check, Mic } from 'lucide-react';
import { getItem } from '../../../data';
import { cx } from '../../../ui';
import { changeChips } from '../../../domain/kioskMenu';
import { kioskNote } from '../model/order';
import { KButton } from '../ui/KButton';
import { Caption, Question, TileGrid } from '../ui/Layout';
import type { KioskFlow } from '../useKioskFlow';
import s from './ChangesStep.module.css';

/** The browser's speech recogniser, where there is one. */
interface Recognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognizerClass = new () => Recognizer;

function recognizerClass(): RecognizerClass | null {
  const w = window as unknown as { SpeechRecognition?: RecognizerClass; webkitSpeechRecognition?: RecognizerClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Listening stops after this much silence, and after this long in all. */
const QUIET_MS = 4000;
const MAX_MS = 15000;

/**
 * Any changes: "No changes" first, then the usual asks for this dish as
 * chips, and a box for anything else. The microphone fills the box by
 * voice with the browser's speech recogniser; a tablet without one just
 * doesn't show it.
 */
export function ChangesStep({ flow }: { flow: KioskFlow }) {
  const st = flow.s;
  const dish = getItem(st.entree) ?? getItem(st.soup);
  const chips = changeChips(dish);
  const Rec = recognizerClass();
  const [picked, setPicked] = useState<string[]>(() => (st.edit ? st.changes.filter((c) => chips.includes(c)) : []));
  const [comment, setComment] = useState(st.edit ? st.comment : '');
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const rec = useRef<Recognizer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = useRef('');

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    rec.current?.stop();
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (rec.current) {
        rec.current.onend = null;
        rec.current.abort();
      }
    },
    [],
  );

  const talk = () => {
    if (listening || !Rec) return stop();
    const r = new Rec();
    base.current = comment.trim();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onresult = (e) => {
      let mid = '';
      let fin = '';
      for (let i = 0; i < e.results.length; i++) {
        const x = e.results[i];
        if (x.isFinal) fin += ' ' + x[0].transcript;
        else mid += x[0].transcript;
      }
      setComment(`${base.current} ${fin.trim()}`.trim());
      setPartial(mid.trim());
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(stop, QUIET_MS);
    };
    r.onerror = () => undefined;
    r.onend = () => {
      if (timer.current) clearTimeout(timer.current);
      setPartial('');
      setListening(false);
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
      timer.current = setTimeout(stop, MAX_MS);
    } catch {
      setListening(false);
    }
  };

  const any = picked.length > 0 || comment.trim().length > 0;
  const toggle = (c: string) => setPicked((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c]));
  const done = (changes: string[], text: string) => {
    stop();
    flow.advance({ changes, comment: text, note: kioskNote(changes, text) });
  };

  return (
    <div>
      <Question title="Any changes to your meal?" />
      <div className={s.top}>
        <KButton look={any ? 'secondary' : 'primary'} className={s.topBtn} icon={<Check size="1.1em" strokeWidth={3} aria-hidden />} onClick={() => done([], '')}>
          No changes
        </KButton>
        {any && (
          <KButton look="primary" className={s.topBtn} onClick={() => done(chips.filter((c) => picked.includes(c)), comment.trim())}>
            Continue
          </KButton>
        )}
      </div>
      <Caption>Common changes</Caption>
      <TileGrid min={280} gap={14}>
        {chips.map((c) => {
          const on = picked.includes(c);
          return (
            <KButton key={c} look={on ? 'selected' : 'secondary'} className={s.chip} icon={on ? <Check size="1em" strokeWidth={3} aria-hidden /> : undefined} onClick={() => toggle(c)}>
              {c}
            </KButton>
          );
        })}
      </TileGrid>
      <div className={s.elseCaption}>
        <Caption>Anything else?</Caption>
      </div>
      <div className={s.noteRow}>
        <textarea
          className={cx(s.note, listening && s.noteListening)}
          value={listening && partial ? `${comment} ${partial}`.trim() : comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="Type a note for the kitchen"
          aria-label="A note for the kitchen"
        />
        {Rec && (
          <KButton column look={listening ? 'selected' : 'secondary'} className={s.mic} onClick={talk} aria-label={listening ? 'Stop listening' : 'Say it instead of typing'}>
            <Mic className={s.micIcon} strokeWidth={2} aria-hidden />
            {listening ? 'Listening' : 'Say it'}
          </KButton>
        )}
      </div>
    </div>
  );
}
