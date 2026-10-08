/** Recipes outside the community's master: Home Office's Global Library and other communities'. */
import type { Recipe, RecipeCategory } from '../../../store/menuEdits';
import globalJson from './seed/global.json';
import othersJson from './seed/otherCommunities.json';

/** Kisco recipes Home Office manages. A community adds one linked (it follows HO's updates) or copies it. */
export const GLOBAL_LIBRARY: Recipe[] = (globalJson as unknown as Recipe[]).map((r) => ({ ...r, scope: 'global' }));

/** Recipes other Kisco communities share; copy only. */
export const OTHER_COMMUNITIES = othersJson as Array<{ id: string; community: string; name: string; cat: RecipeCategory; desc: string }>;
