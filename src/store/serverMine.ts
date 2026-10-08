/**
 * What the server's My tables button shows on this tablet: the table board,
 * the pick up & delivery queue, or the floor map with every table's status.
 * The choice stays until the server changes it, and "Reset demo data" keeps it.
 */
import { createSharedStore, useShared } from '../lib/sharedStore';

export type MineMode = 'tables' | 'pud' | 'map';

export const mineModeStore = createSharedStore<MineMode>('tables', {
  persistKey: 'kisco_server_mine_mode',
  channel: 'kisco-server-mine-mode',
  deviceSetting: true,
});

export const useMineMode = (): MineMode => useShared(mineModeStore);
export const setMineMode = (mode: MineMode) => mineModeStore.set(mode);
