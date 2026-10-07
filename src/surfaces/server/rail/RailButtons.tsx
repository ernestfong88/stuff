import { useState } from 'react';
import { Lock, Maximize, Plus } from 'lucide-react';
import { enterFullscreen, isFullscreen, useFullscreen, useTouchLock } from '../../../shell/fullscreen';
import { toast } from '../../../ui';
import s from './RailButtons.module.css';

/**
 * Full screen, then lock. Servers carry the tablet in an apron, so once it
 * is full screen the same button locks it; the lock shield then swallows
 * every touch until "hold to unlock". The lock stays on if full screen is
 * lost, since that is when it matters most.
 */
export function FullscreenLockButton() {
  const fs = useFullscreen();
  const [, setLocked] = useTouchLock();
  const [busy, setBusy] = useState(false);
  const tap = async () => {
    if (fs) {
      setLocked(true);
      return;
    }
    setBusy(true);
    await enterFullscreen();
    setBusy(false);
    if (!isFullscreen()) toast('This browser blocked full screen. Open it in Chrome.', { tone: 'warning' });
  };
  return (
    <button
      className={s.rail}
      onClick={tap}
      disabled={busy}
      title={fs ? 'Lock the screen so nothing else responds to touch' : 'Full screen'}
      aria-label={fs ? 'Lock screen' : 'Enter full screen'}
    >
      {fs ? <Lock size={24} strokeWidth={2.2} aria-hidden /> : <Maximize size={24} strokeWidth={2.2} aria-hidden />}
      <span className={s.label}>{fs ? 'Lock' : 'Full screen'}</span>
    </button>
  );
}

/** The big "+ Check" button: start a check on a table. */
export function StartCheckButton({ onStart }: { onStart: () => void }) {
  return (
    <button className={s.start} onClick={onStart} title="Start a check" aria-label="Start a check">
      <Plus size={28} strokeWidth={2.5} aria-hidden />
      <span className={s.label}>Check</span>
    </button>
  );
}
