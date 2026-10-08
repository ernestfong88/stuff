/**
 * Speech to text with the browser's Web Speech API (Chrome, Edge and
 * Safari on iPad). Where it is missing, or the microphone is blocked, the
 * voice sheet falls back to typing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternative;
}
interface SpeechResultEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: SpeechResult };
}
interface SpeechErrorEvent {
  readonly error: string;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface Speech {
  /** The browser can listen at all. */
  supported: boolean;
  listening: boolean;
  /** Everything heard so far, final and in-progress words together. */
  transcript: string;
  /** Plain-language reason listening stopped or failed. */
  error: string | null;
  start: () => void;
  /** Stop and keep what was heard. */
  stop: () => void;
  reset: () => void;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'The microphone is blocked on this tablet. Type what you heard instead.',
  'service-not-allowed': 'The microphone is blocked on this tablet. Type what you heard instead.',
  'audio-capture': 'No microphone was found. Type what you heard instead.',
  network: 'Voice needs an internet connection. Type what you heard instead.',
};

export function useSpeech(lang = 'en-US'): Speech {
  const Ctor = recognitionCtor();
  const rec = useRef<Recognition | null>(null);
  const finalText = useRef('');
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    finalText.current = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const words = res[0]?.transcript ?? '';
        if (res.isFinal) finalText.current += (finalText.current ? ' ' : '') + words.trim();
        else interim += words;
      }
      setTranscript((finalText.current + ' ' + interim).trim());
    };
    r.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') setError(ERRORS[e.error] ?? 'Voice stopped working. Type what you heard instead.');
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    setError(null);
    setTranscript('');
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
      setError('Voice could not start. Type what you heard instead.');
    }
  }, [Ctor, lang]);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  const reset = useCallback(() => {
    rec.current?.abort();
    rec.current = null;
    finalText.current = '';
    setTranscript('');
    setError(null);
    setListening(false);
  }, []);

  return { supported: !!Ctor, listening, transcript, error, start, stop, reset };
}
