import { useEffect, useRef, useState } from 'react';
import { isOverlayOpen } from '../../ui/Overlay';
import { bumpHit, resolveBumpKeys, useBumpAssignments, type BumpAction } from './bumpKeys';
import { rowJump, showTicketRow } from './rowNav';

export interface TicketSelection {
  ticket: number;
  line: number;
}

export interface BumpBarOptions {
  /** Off while another page (bump keys, associates) covers the tickets. */
  enabled: boolean;
  ticketCount: number;
  /** Bumpable lines on a ticket, in screen order. */
  lineCount: (ticket: number) => number;
  /**
   * Bump the highlighted line. Return true when the line went to ready, so
   * the highlight moves on to the next line.
   */
  onBumpItem: (ticket: number, line: number) => boolean;
  onBumpTicket: (ticket: number) => void;
  onMenu?: () => void;
}

const noFocus = () => !document.activeElement || document.activeElement === document.body;
/**
 * A control outside the tickets that a keyboard user tabbed to: Enter and
 * Space belong to it. (After a tap, focus is not "visible", so a bump bar
 * keeps working when the cook last touched a header button.)
 */
const keyboardOnControl = () => {
  const el = document.activeElement;
  return el instanceof HTMLElement && el !== document.body && !el.closest('[data-kscroll]') && el.matches(':focus-visible');
};
const isTyping =(t: EventTarget | null) => t instanceof HTMLElement && /^(input|textarea|select)$/i.test(t.tagName);

/**
 * Keyboard and bump bar control of a ticket grid: which ticket and line is
 * highlighted, and what each key does with it. Returns the selection
 * (clamped to the tickets on screen) and a setter for taps.
 */
export function useBumpBar(opts: BumpBarOptions): [TicketSelection, (s: TicketSelection) => void] {
  const [sel, setSel] = useState<TicketSelection>({ ticket: 0, line: 0 });
  const keys = resolveBumpKeys(useBumpAssignments());
  const latest = useRef({ opts, sel, keys });
  latest.current = { opts, sel, keys };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { opts: o, sel: cur, keys: map } = latest.current;
      if (!o.enabled || !o.ticketCount || isOverlayOpen() || isTyping(e.target)) return;
      if (e.metaKey || e.altKey || (e.ctrlKey && e.key !== 'Control')) return;
      if ((e.key === 'Enter' || e.key === ' ') && keyboardOnControl()) return;
      const hit = (a: BumpAction) => bumpHit(map, a, e);
      const t = Math.min(cur.ticket, o.ticketCount - 1);
      const lines = o.lineCount(t);
      const go = (ticket: number, line = 0) => {
        e.preventDefault();
        setSel({ ticket, line });
        showTicketRow(ticket);
      };
      if (hit('left')) go(Math.max(0, t - 1));
      else if (hit('right')) go(Math.min(o.ticketCount - 1, t + 1));
      else if (hit('up')) {
        e.preventDefault();
        if (cur.line > 0) setSel({ ticket: t, line: Math.min(cur.line, lines) - 1 });
        else {
          const above = rowJump(t, -1);
          if (above !== t) go(above, Math.max(0, o.lineCount(above) - 1));
        }
      } else if (hit('down')) {
        e.preventDefault();
        if (cur.line < lines - 1) setSel({ ticket: t, line: cur.line + 1 });
        else {
          const below = rowJump(t, 1);
          if (below !== t) go(below);
        }
      } else if (e.key === 'Tab' && noFocus()) {
        // Tab walks the lines only while nothing has focus, so a keyboard
        // user can still tab through the header controls.
        e.preventDefault();
        const step = e.shiftKey ? -1 : 1;
        setSel({ ticket: t, line: Math.max(0, Math.min(Math.max(0, lines - 1), cur.line + step)) });
      } else if (/^[0-9]$/.test(e.key)) {
        const n = Number(e.key);
        if (n < o.ticketCount) go(n);
      } else if (hit('bumpItem')) {
        if (cur.line >= lines) return;
        e.preventDefault();
        if (o.onBumpItem(t, cur.line) && cur.line < lines - 1) setSel({ ticket: t, line: cur.line + 1 });
      } else if (hit('bumpTicket')) {
        e.preventDefault();
        o.onBumpTicket(t);
      } else if (hit('menu') && o.onMenu) {
        e.preventDefault();
        o.onMenu();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const clamped = { ticket: Math.max(0, Math.min(sel.ticket, opts.ticketCount - 1)), line: sel.line };
  return [clamped, setSel];
}
