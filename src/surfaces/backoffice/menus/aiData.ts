/**
 * What the menu review knows beyond the menu itself: suggestions for the
 * winter draft, last season's results, nearby communities' dishes, protein
 * targets and season notes. Demo data written for VT Winter.
 */
import type { Recipe } from '../../../store/menuEdits';
import type { AiOp, PastSeasonItem, Season } from './model/aiReview';
import aiJson from './seed/aiReview.json';
import { now } from '../../../lib/clock';
import { quarterIndexOf, quarterLabel, quarterMenuName } from '../../../domain/menuCycle';

export interface AiSuggestion {
  id: string;
  type: string;
  priority: string;
  title: string;
  action: string;
  reason: string;
  target: { week: number; day: number; date?: string; meal?: string; slot?: string };
  currentItem?: { recipe: string; name: string };
  suggestedItem?: { recipe: string; name: string; isNew?: boolean; source?: string };
  newDefaultSides?: Array<{ recipe: string; name: string }>;
  moveTo?: { week: number; day: number; meal?: string; replaces: { name: string } };
  stats?: Record<string, unknown>;
  ops: AiOp[];
  anyDaySides: string[];
}

interface AiFile {
  ai: {
    disclaimer: string;
    summary: { headline: string };
    seasonNotes: {
      tooLight: Array<{ day: number; meal: string; item: string; why: string }>;
      leanOn: Array<{ produce: string; peak: string; onDraft: number; examples: string[] }>;
      coldSidesByWeek: Array<{ week: number; coldSpecialSides: number }>;
      observations: string[];
    };
    pastSeason: { menu: string; source: string; items: PastSeasonItem[] };
    regional: {
      region: string;
      note: string;
      ideas: Array<{
        community: string;
        dish: string;
        proposedRecipe: string;
        score: number;
        ratings: number;
        runs: number;
        ordersPerRun: number;
        wouldReplace: { name: string };
        day: number;
        meal: string;
        why: string;
      }>;
    };
    weakItems: Array<{ recipe: string; dish: string; score: number; orders: number; onDraft?: Array<{ day: number; meal: string }>; suggestion?: string }>;
    suggestions: Array<Omit<AiSuggestion, 'ops'> & { ops: Array<Record<string, unknown>> }>;
  };
  target: Record<string, Record<string, number>>;
  proposed: Recipe[];
  inSeason: { winter: string[]; fall: string[] };
  holidayOnly: string[];
}

/**
 * The review was written for next quarter's menu when it was called "VT
 * Winter 2026"; the seed names menus after their quarter from today (see
 * seedMenus in ./data), so it reads with the menu's name as Back Office
 * shows it ("VT Winter 2027").
 */
const AI_WRITTEN_FOR = 'VT Winter 2026';
const aiMenuName = quarterMenuName(quarterLabel(quarterIndexOf(now()) + 1), 'cycle');
const file = JSON.parse(JSON.stringify(aiJson).split(AI_WRITTEN_FOR).join(aiMenuName)) as AiFile;

/** The menu the suggestions were written for (the winter draft). */
export const AI_MENU_ID = 'm5';

function toOp(o: Record<string, unknown>): AiOp {
  return o as unknown as AiOp;
}

export const AI = {
  ...file.ai,
  suggestions: file.ai.suggestions.map((sg) => ({ ...sg, ops: sg.ops.map(toOp) })) as AiSuggestion[],
};
export const PROTEIN_TARGET = file.target;
/** Recipes the suggestions bring in from other communities, added to the master when applied. */
export const PROPOSED_RECIPES = file.proposed;
export const HOLIDAY_ONLY = new Set(file.holidayOnly);

export function inSeasonSet(season: Season): Set<string> {
  return new Set(season === 'Winter' ? file.inSeason.winter : season === 'Fall' ? file.inSeason.fall : []);
}

/** Produce and notes for a season (winter has the detailed notes in AI.seasonNotes). */
export const SEASON_NOTES: Record<Exclude<Season, 'Winter'>, { lean: Array<[string, string]>; obs: string[] }> = {
  Fall: {
    lean: [
      ['Apples and pears', 'September to December'],
      ['Winter squash and pumpkin', 'October to February'],
      ['Sweet potatoes and root vegetables', 'All fall'],
      ['Brussels sprouts and cauliflower', 'October onward'],
    ],
    obs: [
      'Lighter lunches still sell through early October; save the heavy braises for November.',
      'Halloween and Thanksgiving fall inside the cycle. Plan the treats a week ahead.',
    ],
  },
  Spring: {
    lean: [
      ['Asparagus and peas', 'March to May'],
      ['Artichokes', 'March to May'],
      ['Strawberries', 'April onward'],
      ['Spring onions and herbs', 'All spring'],
    ],
    obs: ['Move from braises to grilled and roasted plates.', "Easter and Mother's Day brunch usually need a special."],
  },
  Summer: {
    lean: [
      ['Stone fruit and berries', 'June to August'],
      ['Tomatoes and corn', 'July to September'],
      ['Zucchini and summer squash', 'All summer'],
      ['Melons', 'July onward'],
    ],
    obs: ['Cold soups and entree salads carry lunch.', 'Hydration: offer fruit sides and lighter desserts on hot days.'],
  },
};
