import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../../ui';
import s from './AnchoredMenu.module.css';

interface Place {
  left: number;
  top?: number;
  bottom?: number;
}

/** The text-size zoom on #root; fixed boxes inside it are placed in zoomed pixels. */
function rootZoom(): number {
  const z = parseFloat(document.getElementById('root')?.style.zoom || '');
  return z > 0 ? z : 1;
}

/**
 * A small menu that floats next to its trigger. It is placed with fixed
 * coordinates, so a scrolling column (the check's diner list) never clips
 * it, and flips above the trigger near the bottom of the screen. Closes on
 * a tap outside, Escape, scroll or resize.
 */
export function AnchoredMenu({
  trigger,
  children,
  width,
  height,
  align = 'left',
  label,
}: {
  trigger: (api: { open: boolean; toggle: () => void }) => ReactNode;
  children: (api: { close: () => void }) => ReactNode;
  width: number;
  /** Expected height, to decide whether it fits below. */
  height: number;
  align?: 'left' | 'right';
  label: string;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const close = () => setPlace(null);

  const toggle = () => {
    if (place) return close();
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const z = rootZoom();
    const vw = window.innerWidth / z;
    const vh = window.innerHeight / z;
    const left = align === 'right' ? r.right / z - width : r.left / z;
    const clamped = Math.max(8, Math.min(left, vw - width - 8));
    const below = vh - r.bottom / z > height + 12;
    setPlace(below ? { left: clamped, top: r.bottom / z + 5 } : { left: clamped, bottom: vh - r.top / z + 5 });
  };

  useEffect(() => {
    if (!place) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onMove = (e: Event) => {
      if (panel.current && e.target instanceof Node && panel.current.contains(e.target)) return;
      close();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [place]);

  useLayoutEffect(() => {
    if (place) panel.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [place]);

  return (
    <span ref={anchor} className={s.anchor} onClick={(e) => e.stopPropagation()}>
      {trigger({ open: !!place, toggle })}
      {place &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            aria-label={label}
            className={cx(s.panel, 'pop-in')}
            style={{ left: place.left, top: place.top, bottom: place.bottom, width }}
            onClick={(e) => e.stopPropagation()}
          >
            {children({ close })}
          </div>,
          document.getElementById('root') ?? document.body,
        )}
    </span>
  );
}
