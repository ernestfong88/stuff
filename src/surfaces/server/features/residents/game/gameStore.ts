/**
 * Games played on this tablet. Scores stay on the device (there is no
 * scoring service yet); the other players on the board are seeded.
 */
import { createSharedStore, useShared } from '../../../../../lib/sharedStore';
import type { CareType, GamePlay } from './gameLogic';

const KEEP = 400;

export const gamePlaysStore = createSharedStore<GamePlay[]>([], { persistKey: 'kisco_server_rgame_v1' });

/** The care types picked for the last game, kept for the next one. */
export const gameTypesStore = createSharedStore<CareType[] | null>(null, { persistKey: 'kisco_server_rgame_types' });

export function useGamePlays(): GamePlay[] {
  return useShared(gamePlaysStore);
}

export function useGameTypes(): CareType[] | null {
  return useShared(gameTypesStore);
}

export function recordPlay(play: GamePlay): void {
  gamePlaysStore.set((list) => [...list, play].slice(-KEEP));
}

export function updatePlay(id: string, patch: Partial<GamePlay>): void {
  gamePlaysStore.set((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
}
