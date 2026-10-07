import { useEffect, type RefObject } from 'react';

/**
 * Close a floating panel on Escape or a press outside `root`, handing
 * focus back to the trigger on Escape.
 */
export function useDismiss(open: boolean, close: () => void, root: RefObject<HTMLElement | null>, trigger?: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
      trigger?.current?.focus();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close, root, trigger]);
}
