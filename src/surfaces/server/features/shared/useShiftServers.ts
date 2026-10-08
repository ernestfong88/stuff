import { useMemo } from 'react';
import { useMe } from '../../../../shell/session';
import { useDiningOrders } from '../../../../store/dining';

/** Initials of the signed-in associate. */
export function useMyInitials(): string {
  return useMe().initials;
}

/** Servers holding a dine-in check right now (for "2nd of 3"). */
export function useShiftServers(): string[] {
  const orders = useDiningOrders();
  return useMemo(() => [...new Set(orders.filter((o) => !o.queueType && o.server).map((o) => o.server))], [orders]);
}
