import type {
  BoMenu,
  BoModGroup,
  GridEntry,
  ModRuleEdit,
  PriceRow,
  Recipe,
  SideOverrides,
  VenueSchedule,
} from '../../../../store/menuEdits';

/** Back Office's menu data: the seed with every saved edit applied. */
export interface BoState {
  recipes: Recipe[];
  grid: GridEntry[];
  menus: BoMenu[];
  venues: VenueSchedule[];
  modGroups: BoModGroup[];
  /** Rule edits by group id, over ruleDefaults. */
  modRules: Record<string, ModRuleEdit>;
  prices: PriceRow[];
  sides: SideOverrides;
  favorites: Record<string, true>;
}

/** Meals a menu builder lays out; Snacks never reach the server's menu. */
export type BuilderMeal = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
export const BUILDER_MEALS: BuilderMeal[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
