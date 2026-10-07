/**
 * Servers on the floor: names, colours, and who should take a new table.
 */
import { getTable, serverColors, staff } from '../data';
import type { Order } from './types';

/** Colours for servers outside the fixed demo staff, picked by a hash of their id. */
export const SPARE_SERVER_COLORS = ['#2F8C8C', '#B23B2E', '#8A6A12', '#4D7093'];

/** Staff outside the PIN list who still appear on seeded checks. */
const EXTRA_SERVER_NAMES: Record<string, string> = { MG: 'Marisol' };

/** __kServerName: a server's first name by id or initials. */
export function serverName(id: string): string {
  const s = staff.find((x) => x.id === id || x.initials === id);
  return s ? s.name.split(' ')[0] : (EXTRA_SERVER_NAMES[id] ?? id);
}

/**
 * __kSrvColor: fixed for the demo staff (__K_SRV_FIXED) so a colour means
 * the same person on the host floor, the manager floor and the legends.
 */
export function serverColor(id: string | null | undefined): string {
  if (id && serverColors[id]) return serverColors[id];
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SPARE_SERVER_COLORS[h % SPARE_SERVER_COLORS.length];
}

export interface ServerOnFloor {
  id: string;
  /** First name ("" for someone not on the staff list). */
  name: string;
  color: string;
  /** Open checks they hold. */
  open: number;
}

/** __kServers: every staff member plus anyone holding a check, with their open check count. */
export function serversOnFloor(live: Order[]): ServerOnFloor[] {
  const ids = staff.map((s) => s.initials);
  for (const o of live) if (o.server && !ids.includes(o.server)) ids.push(o.server);
  return ids.map((id) => {
    const s = staff.find((x) => x.initials === id || x.id === id);
    return {
      id,
      name: s ? s.name.split(' ')[0] : '',
      color: serverColor(id),
      open: live.filter((o) => o.server === id).length,
    };
  });
}

/**
 * __kSuggestServer: nothing in the data says who owns a section, so "whose
 * section" is read off the floor: whoever already holds the most checks in
 * that section. With nobody there yet, the server carrying the fewest checks.
 */
export function suggestServer(
  table: { section: string } | null | undefined,
  live: Order[],
  servers: ServerOnFloor[],
): string | null {
  const inSection: Record<string, number> = {};
  for (const o of live) {
    const tb = getTable(o.tableId);
    if (tb && table && tb.section === table.section) inSection[o.server] = (inSection[o.server] || 0) + 1;
  }
  const bySection = servers
    .filter((s) => inSection[s.id])
    .sort((a, b) => inSection[b.id] - inSection[a.id] || a.open - b.open)[0];
  return (bySection ?? servers.slice().sort((a, b) => a.open - b.open)[0])?.id ?? null;
}
