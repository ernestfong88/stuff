/**
 * Communities and KiscoConnect modules for the back office side nav.
 * Extracted from the prototype (__K_COMMUNITIES, __K_MODULES).
 */
import shellJson from './shell.json';

/** A group of communities ("Signature", "Lifestyle" ...) and its members. */
export type CommunityGroup = [group: string, communities: string[]];

const seed = shellJson as unknown as { communities: CommunityGroup[][]; modules: string[] };

/** Community groups laid out in the switcher's two columns. */
export const COMMUNITY_COLUMNS: CommunityGroup[][] = seed.communities;

/** Every community, in switcher order. */
export const ALL_COMMUNITIES: string[] = COMMUNITY_COLUMNS.flat().flatMap(([, list]) => list);
