import { useEffect, useRef } from 'react';
import { cx } from '../../../../ui';
import type { TablePay } from './closeMath';
import s from './Payment.module.css';

export type TerminalState = 'idle' | 'sent' | 'paid';

/** How long the demo terminal takes to report a tap. */
const TAP_MS = 2600;

/** Demo card references shown once a card is paid. */
const CARDS = [
  { card: 'Visa •••• 4242', ref: 'sq_7F3K2' },
  { card: 'Amex •••• 1007', ref: 'sq_9B1QX' },
];

/**
 * The Square terminal at the front desk. KiscoConnect holds the check; the
 * terminal takes the tap and nothing else, so there is no tip screen and
 * no second total to reconcile.
 */
export function Terminal({
  label,
  amount,
  state,
  index = 0,
  onState,
}: {
  label: string;
  amount: number;
  state: TerminalState;
  /** Which demo card pays (0 or 1). */
  index?: number;
  onState: (st: TerminalState) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stateRef = useRef(onState);
  stateRef.current = onState;
  useEffect(() => {
    if (state !== 'sent') return;
    timer.current = setTimeout(() => stateRef.current('paid'), TAP_MS);
    return () => clearTimeout(timer.current);
  }, [state]);
  const paid = CARDS[index] ?? CARDS[0];
  return (
    <div className={cx(s.terminal, state === 'paid' && s.paid)}>
      <div className={s.row}>
        <span className={cx(s.dot, state === 'sent' && s.dotWait)} aria-hidden />
        <span className={s.label}>{label}</span>
        <span className={s.status}>{state === 'paid' ? 'paid' : state === 'sent' ? 'waiting for tap…' : 'online'}</span>
        <span className={s.amount}>${amount.toFixed(2)}</span>
      </div>
      {state === 'idle' && (
        <button className={s.send} onClick={() => onState('sent')}>
          Send to terminal
        </button>
      )}
      {state === 'sent' && (
        <div className={s.waiting} role="status">
          <span className={s.waitText}>Guest is tapping or dipping on the terminal…</span>
          <button className={s.cancel} onClick={() => onState('idle')}>
            Cancel on terminal
          </button>
        </div>
      )}
      {state === 'paid' && (
        <div className={s.done} role="status">
          <strong>Paid</strong> · {paid.card} · Square ref {paid.ref} · receipt offered on the terminal
        </div>
      )}
    </div>
  );
}

/** Card payment for the whole table: each person pays, one card, or split across two. */
export function TablePayment({
  mode,
  total,
  split,
  states,
  onMode,
  onSplit,
  onState,
}: {
  mode: TablePay;
  total: number;
  split: number;
  states: Record<number, TerminalState>;
  onMode: (m: TablePay) => void;
  onSplit: (pct: number) => void;
  onState: (index: number, st: TerminalState) => void;
}) {
  const amounts = mode === 'one' ? [total] : [Math.round(total * split) / 100, Math.round(total * (100 - split)) / 100];
  return (
    <div className={s.table}>
      <div className={s.eyebrow}>Card payment for the table</div>
      <p className={s.lede}>
        KiscoConnect holds the check. The terminal takes the tap and nothing else, so there is no tip screen and no second total to
        reconcile.
      </p>
      <div className={s.modes} role="radiogroup" aria-label="Card payment">
        {(
          [
            ['each', 'Each person pays their own'],
            ['one', 'One card for the whole table'],
            ['split', 'Split the table across 2 cards'],
          ] as Array<[TablePay, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            role="radio"
            aria-checked={mode === id}
            className={cx(s.mode, mode === id && s.modeOn)}
            onClick={() => onMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {mode !== 'each' && (
        <div className={s.cards}>
          {mode === 'split' && (
            <div className={s.split}>
              <span>Split</span>
              {[50, 60, 70].map((p) => (
                <button key={p} className={cx(s.pct, split === p && s.pctOn)} aria-pressed={split === p} onClick={() => onSplit(p)}>
                  {p} / {100 - p}
                </button>
              ))}
              <span className={s.any}>or any amounts on the terminal</span>
            </div>
          )}
          {amounts.map((amt, i) => (
            <Terminal
              key={i}
              index={i}
              label={(mode === 'one' ? 'Whole table' : `Card ${i + 1}`) + ' · Square Terminal · Front desk'}
              amount={amt}
              state={states[i] ?? 'idle'}
              onState={(st) => onState(i, st)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
