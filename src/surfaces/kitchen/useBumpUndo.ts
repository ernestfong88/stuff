import { useCallback, useRef } from 'react';
import { useDining } from '../../store/dining';
import { toast } from '../../ui';
import { linesToRestore, type LineState } from './lineSnapshot';

/**
 * After a bump, a short "SQ 5 bumped · Undo" message. Undo puts the plates
 * that moved back where they were, so a wet thumb on the wrong ticket costs
 * one tap to fix.
 */
export function useBumpUndo(): (orderId: string, before: LineState[], message: string) => void {
  const dining = useDining();
  const latest = useRef(dining);
  latest.current = dining;
  return useCallback((orderId, before, message) => {
    if (!before.length) return;
    toast(message, {
      tone: 'success',
      action: {
        label: 'Undo',
        onClick: () => {
          const d = latest.current;
          const o = d.orders.find((x) => x.id === orderId);
          if (!o) return;
          for (const l of linesToRestore(before, o)) d.setItemKitchenState(orderId, l.id, l.state);
        },
      },
    });
  }, []);
}
