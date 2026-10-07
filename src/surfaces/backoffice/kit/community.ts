/**
 * The community the back office is looking at. Per-community settings
 * (sick fee waivers, guest meal credits) are read and written for it.
 */
import { COMMUNITY_NAME } from '../../../data';
import { createSharedStore, useShared } from '../../../lib/sharedStore';
import { ALL_COMMUNITIES } from '../seed/shell';

const communityStore = createSharedStore<string>(() => COMMUNITY_NAME, {
  persistKey: 'kisco_backoffice_community',
  channel: 'kisco-backoffice-community',
});

/** The current community name, e.g. "Valencia Terrace". */
export function useCommunity(): string {
  const name = useShared(communityStore);
  return ALL_COMMUNITIES.includes(name) ? name : COMMUNITY_NAME;
}

export function setCommunity(name: string): void {
  communityStore.set(name);
}

/**
 * Communities matching a search, keeping the switcher's grouping. A group
 * name match keeps the whole group ("balfour" lists every Balfour).
 */
export function filterCommunityGroups<G extends [string, string[]]>(columns: G[][], query: string): Array<Array<[string, string[]]>> {
  const q = query.trim().toLowerCase();
  return columns
    .map((col) =>
      col
        .map(([group, list]): [string, string[]] => [group, q ? list.filter((c) => c.toLowerCase().includes(q) || group.toLowerCase().includes(q)) : list])
        .filter(([, list]) => list.length > 0),
    )
    .filter((col) => col.length > 0);
}
