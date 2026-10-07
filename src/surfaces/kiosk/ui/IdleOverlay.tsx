import { useEffect, useRef } from 'react';
import { KButton } from './KButton';
import s from './IdleOverlay.module.css';

/** "Are you still there?" with the seconds left before the kiosk starts over. */
export function IdleOverlay({ secondsLeft, onStay }: { secondsLeft: number; onStay: () => void }) {
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => stay.current?.focus({ preventScroll: true }), []);
  return (
    <div className={s.backdrop} role="alertdialog" aria-modal="true" aria-labelledby="kk-idle-title" aria-describedby="kk-idle-left">
      <div className={s.card}>
        <h1 id="kk-idle-title" className={s.title}>
          Are you still there?
        </h1>
        <p id="kk-idle-left" className={s.left} aria-live="polite">
          We&rsquo;ll start over in {secondsLeft} {secondsLeft === 1 ? 'second' : 'seconds'}.
        </p>
        <KButton ref={stay} look="primary" block className={s.stay} onClick={onStay}>
          Yes, I&rsquo;m still here
        </KButton>
      </div>
    </div>
  );
}
