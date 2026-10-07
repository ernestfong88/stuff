/**
 * Culinary App PINs reset in the back office (Associates & PINs), by staff
 * id. A reset PIN replaces the roster's at once on every device; the old one
 * stops working.
 */
import { createSharedStore, useShared } from '../lib/sharedStore';

export const pinOverrides = createSharedStore<Record<string, string>>({}, { persistKey: 'kisco_backoffice_pins', channel: 'kisco-backoffice-pins' });

export function usePinOverrides(): Record<string, string> {
  return useShared(pinOverrides);
}

export function setPin(id: string, pin: string): void {
  pinOverrides.set((p) => ({ ...p, [id]: pin }));
}
