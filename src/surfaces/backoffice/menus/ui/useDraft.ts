/**
 * A text field that keeps what is being typed to itself and saves it a
 * moment later. Saving a recipe recomputes what the floor sees and writes the
 * whole menu store, so it happens when typing pauses (DRAFT_DELAY_MS) or the
 * field loses focus, not on every key. Switching to another recipe, or
 * leaving the page, saves what was typed first, to the recipe it was typed in.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Pause in typing before the text is saved. */
export const DRAFT_DELAY_MS = 400;

/** Every field with typing waiting to be saved: saved at once when the page is hidden or left. */
const waiting = new Set<() => void>();
const saveAll = () => [...waiting].forEach((f) => f());
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('pagehide', saveAll);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveAll());
}

export interface DraftField {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  onBlur: () => void;
}

/**
 * `value` is the saved text, `commit` saves new text. `key` names what is being
 * edited (the recipe id): when it changes the field shows the new value at once.
 * With `immediate` every change is saved straight away (a draft that is only kept
 * until Save, say). Spread the result onto an input or textarea.
 */
export function useDraft(value: string, commit: (v: string) => void, key: string, immediate = false): DraftField {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState({ key, value });
  const pending = useRef<{ v: string; commit: (v: string) => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const p = pending.current;
    pending.current = null;
    p?.commit(p.v);
  }, []);
  useEffect(() => {
    waiting.add(flush);
    return () => void waiting.delete(flush);
  }, [flush]);

  // A new saved value (ours coming back, another tab's, the AI's) shows unless typing is still waiting to be saved.
  if (seen.key !== key || seen.value !== value) {
    setSeen({ key, value });
    if (seen.key !== key || !pending.current) setDraft(value);
  }

  // Another recipe, or leaving: save what was typed in this one.
  useEffect(() => flush, [key, flush]);

  return {
    value: draft,
    onChange: (e) => {
      const v = e.target.value;
      setDraft(v);
      if (immediate) return commit(v);
      pending.current = { v, commit };
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, DRAFT_DELAY_MS);
    },
    onBlur: flush,
  };
}
