import { formatElapsed } from '../lib/format';
import { useTick } from './ticker';

export interface ElapsedProps {
  /** Start of the timer, in ms on the demo clock. */
  since: number;
  /** Text for the time gone by (default m:ss, or h:mm:ss); also given the current time. */
  format?: (elapsedMs: number, now: number) => string;
}

/**
 * A running timer as plain text ("4:05"). It ticks every second on its own,
 * so the card around it only re-renders when something else changes.
 */
export function Elapsed({ since, format = formatElapsed }: ElapsedProps) {
  const t = useTick(1000);
  return format(t - since, t);
}

/** Text that depends on the time to the second (a countdown, "due 7:15 PM" turning into a timer), redrawn every second on its own. */
export function Ticking({ text }: { text: (now: number) => string }) {
  return text(useTick(1000));
}
