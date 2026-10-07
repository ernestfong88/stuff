/**
 * Full screen and touch lock for wall-mounted and shared tablets.
 * Locked: a transparent shield swallows touches until "hold to unlock".
 */
import { useEffect, useState } from 'react';
import { createSharedStore, useShared } from '../lib/sharedStore';

type FsDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };

export function isFullscreen(): boolean {
  const d = document as FsDocument;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

export async function enterFullscreen(): Promise<void> {
  const el = document.documentElement as FsElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else el.webkitRequestFullscreen?.();
  } catch {
    /* not allowed here (iOS Safari, iframes) */
  }
}

export async function exitFullscreen(): Promise<void> {
  const d = document as FsDocument;
  try {
    if (d.exitFullscreen && d.fullscreenElement) await d.exitFullscreen();
    else d.webkitExitFullscreen?.();
  } catch {
    /* ignore */
  }
}

export function useFullscreen(): boolean {
  const [fs, setFs] = useState(isFullscreen);
  useEffect(() => {
    const on = () => setFs(isFullscreen());
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => {
      document.removeEventListener('fullscreenchange', on);
      document.removeEventListener('webkitfullscreenchange', on);
    };
  }, []);
  return fs;
}

export const touchLock = createSharedStore(false);

export function useTouchLock(): [boolean, (v: boolean) => void] {
  return [useShared(touchLock), (v) => touchLock.set(v)];
}
