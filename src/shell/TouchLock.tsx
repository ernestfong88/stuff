import { useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useTouchLock } from './fullscreen';
import s from './TouchLock.module.css';

const HOLD_MS = 900;

/** While locked, swallows every touch; hold the badge to unlock. */
export function TouchLock() {
  const [locked, setLocked] = useTouchLock();
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!locked) return null;
  const start = () => {
    setHolding(true);
    timer.current = setTimeout(() => {
      setLocked(false);
      setHolding(false);
    }, HOLD_MS);
  };
  const stop = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };
  return (
    <div className={s.shield} onContextMenu={(e) => e.preventDefault()}>
      <button className={s.badge} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} aria-label="Hold to unlock">
        <Lock size={16} strokeWidth={2.4} />
        {holding ? 'Keep holding…' : 'Locked · hold to unlock'}
        {holding && <span className={s.progress} style={{ animationDuration: `${HOLD_MS}ms` }} />}
      </button>
    </div>
  );
}
