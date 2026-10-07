import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { ModeChip, TextZoom } from '../../shell/controls';
import { cx } from '../../ui';
import s from './StaffCorner.module.css';

const HOLD_MS = 900;
const SHOW_MS = 15_000;

/**
 * Staff-only controls (text size, switch mode) for screens residents use or
 * watch. Nothing shows until someone presses and holds the top right corner
 * for about a second, so a resident can't switch the kiosk or the TV away
 * by accident. Keyboard users reach the same spot with Tab and Enter.
 * The controls hide again after a short while.
 */
export function StaffCorner({ dark }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(0);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };
  const start = () => {
    cancel();
    hold.current = setTimeout(() => setOpen(true), HOLD_MS);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((v) => !v);
    }
  };

  useEffect(() => cancel, []);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), SHOW_MS);
    return () => clearTimeout(t);
  }, [open, touched]);

  if (!open) {
    return (
      <button
        className={s.hotspot}
        aria-label="Staff controls: press and hold"
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={onKey}
      />
    );
  }
  return (
    <div className={cx(s.panel, dark && s.dark)} role="group" aria-label="Staff controls" onPointerDown={() => setTouched((n) => n + 1)}>
      <TextZoom dark={dark} tall />
      <ModeChip dark={dark} tall />
      <button className={s.close} onClick={() => setOpen(false)} aria-label="Hide staff controls">
        <X size={18} strokeWidth={2.4} />
      </button>
    </div>
  );
}
