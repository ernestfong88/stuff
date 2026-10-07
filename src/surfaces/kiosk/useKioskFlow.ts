import { useCallback, useMemo, useState } from 'react';
import type { MealName } from '../../domain/types';
import { backWithin, INITIAL_STATE, nextStep, type KioskState, type Screen } from './model/flow';
import type { KioskMenu } from '../../domain/kioskMenu';

export interface KioskFlow {
  s: KioskState;
  menu: KioskMenu | null;
  /** Go to a screen (remembered for Back), with answers. */
  go: (step: Screen, patch?: Partial<KioskState>) => void;
  /** Change answers on this screen. */
  put: (patch: Partial<KioskState>) => void;
  /** Answer and go on to the next question that applies. */
  advance: (patch?: Partial<KioskState>) => void;
  back: () => void;
  reset: () => void;
  /** Start over after placing an order, keeping nothing. */
  finish: (patch: Partial<KioskState>) => void;
}

/** The kiosk's answers and the screen history behind Back. */
export function useKioskFlow(menuFor: (meal: MealName) => KioskMenu): KioskFlow {
  const [s, setS] = useState<KioskState>(INITIAL_STATE);
  const [history, setHistory] = useState<Screen[]>([]);
  const menu = useMemo(() => (s.meal ? menuFor(s.meal) : null), [s.meal, menuFor]);

  const reset = useCallback(() => {
    setS(INITIAL_STATE);
    setHistory([]);
  }, []);

  const go = useCallback(
    (step: Screen, patch: Partial<KioskState> = {}) => {
      setHistory((h) => [...h, s.step]);
      setS((p) => ({ ...p, more: null, ...patch, step }));
    },
    [s.step],
  );

  const put = useCallback((patch: Partial<KioskState>) => setS((p) => ({ ...p, ...patch })), []);

  const advance = useCallback(
    (patch: Partial<KioskState> = {}) => {
      const q = { ...s, ...patch };
      const next = nextStep(q, q.meal ? menuFor(q.meal) : null);
      go(next, next === 'review' ? { ...patch, edit: false } : patch);
    },
    [s, menuFor, go],
  );

  const back = useCallback(() => {
    const within = backWithin(s);
    if (within) return put(within);
    if (!history.length) return reset();
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setS((q) => ({ ...q, step: prev, more: null, edit: prev === 'review' || prev === 'change' ? false : q.edit }));
  }, [s, history, put, reset]);

  const finish = useCallback((patch: Partial<KioskState>) => {
    setHistory([]);
    setS((p) => ({ ...p, ...patch, step: 'done' }));
  }, []);

  return { s, menu, go, put, advance, back, reset, finish };
}
