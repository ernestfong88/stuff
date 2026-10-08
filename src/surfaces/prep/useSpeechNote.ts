/**
 * Dictation for progress notes: the browser's speech recogniser writes the
 * words out as the cook talks, then the cook saves or redoes it. Browsers
 * without a recogniser, or with the microphone blocked, fall back to typing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface Recognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognizerClass = new () => Recognizer;

function recognizerClass(): RecognizerClass | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerClass; webkitSpeechRecognition?: RecognizerClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type NoteStage = 'idle' | 'listen' | 'review' | 'type';

/** Stop listening this long after the last words, and give up after a minute. */
const SILENCE_MS = 5_000;
const MAX_MS = 60_000;

/** Only one card listens at a time: starting another stops this one. */
let stopActive: (() => void) | null = null;

export function speechMessage(error: string | null): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'The microphone is blocked on this tablet. Allow it in the browser settings, or type the note here.';
    case 'audio-capture':
      return 'No microphone was found on this tablet. Type the note here.';
    case 'network':
      return 'Voice needs an internet connection right now. Type the note here.';
    default:
      return "Didn't hear anything. Tap the mic and talk close to the tablet, or type it.";
  }
}

/** Errors that mean voice won't work at all, so the note box opens for typing. */
const BLOCKING = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'network']);

export function useSpeechNote(resetKey: string) {
  const supported = recognizerClass() != null;
  const [stage, setStage] = useState<NoteStage>('idle');
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const rec = useRef<Recognizer | null>(null);
  const finalText = useRef('');
  const interimText = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const error = useRef<string | null>(null);

  const kill = useCallback(() => {
    clearTimeout(timer.current);
    const r = rec.current;
    rec.current = null;
    if (r) {
      r.onresult = r.onerror = r.onend = null;
      try {
        r.abort();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    try {
      rec.current?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const close = useCallback(() => {
    kill();
    setStage('idle');
    setText('');
    setInterim('');
    setMessage(null);
  }, [kill]);

  useEffect(() => kill, [kill]);
  useEffect(() => close, [resetKey, close]);

  const typeInstead = useCallback(() => {
    kill();
    setMessage(null);
    setText('');
    setStage('type');
  }, [kill]);

  const listen = useCallback(() => {
    const Recognizer = recognizerClass();
    kill();
    if (stopActive && stopActive !== kill) stopActive();
    stopActive = kill;
    finalText.current = '';
    interimText.current = '';
    error.current = null;
    setText('');
    setInterim('');
    setMessage(null);
    let r: Recognizer;
    try {
      if (!Recognizer) throw new Error('unsupported');
      r = new Recognizer();
    } catch {
      setMessage("Voice isn't working in this browser, so type the note.");
      setStage('type');
      return;
    }
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onresult = (e) => {
      let fin = '';
      let mid = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += ' ' + res[0].transcript;
        else mid += res[0].transcript;
      }
      finalText.current = fin.trim();
      interimText.current = mid.trim();
      setText(finalText.current);
      setInterim(interimText.current);
      clearTimeout(timer.current);
      timer.current = setTimeout(stop, SILENCE_MS);
    };
    r.onerror = (e) => {
      error.current = e.error || 'error';
    };
    r.onend = () => {
      clearTimeout(timer.current);
      rec.current = null;
      const heard = `${finalText.current} ${interimText.current}`.trim();
      setInterim('');
      setText(heard);
      if (heard) {
        setStage('review');
        return;
      }
      setMessage(speechMessage(error.current));
      setStage(error.current && BLOCKING.has(error.current) ? 'type' : 'idle');
    };
    try {
      r.start();
      rec.current = r;
      setStage('listen');
      timer.current = setTimeout(stop, MAX_MS);
    } catch {
      setMessage("Voice couldn't start, so type the note.");
      setStage('type');
    }
  }, [kill, stop]);

  return { supported, stage, text, setText, interim, message, listen, stop, close, typeInstead };
}
