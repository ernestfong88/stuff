/**
 * The associate menu for a date and meal: the chef's special from that
 * day's menu cycle, the associate special of the week, then the standing
 * choices, each made from a Recipe Book recipe. The soup is always the
 * dining room's soup of the day from the menu cycle. The Associate App, the Manager tablet and Back Office all read it
 * here, so the three never disagree.
 *
 * Back Office keeps the chef's calls with the other service settings:
 *   am.days[date][Lunch|Dinner]  {recipeId (null: none), cap}
 *   am.std[slotId]               recipe for a standing choice
 *   am.wk[monday]                recipe for the associate special of the week (absent: none)
 *   am.weeks[monday].sched       the week is open to plan
 *   am.venue                     the venue whose cycle and kitchen serve associates
 */
import { catalog, ensureItems, rooms } from '../data';
import type { CatalogItem } from '../domain/types';
import {
  COMBO_NAME,
  DEFAULT_SPECIAL_CAP,
  STANDING_SLOTS,
  closedReason,
  soupOfTheDay,
  specialPeriodOf,
  weekSpecialFor,
  type AssocMealKind,
  type AssocMenuItem,
  type DayPicks,
  type DaySpecialPick,
  type MenuWeek,
  type StandingSlot,
} from '../domain/assocMeals/menu';
import { DEFAULT_ASSOC_VENUE } from '../domain/assocMeals/settings';
import { useShared } from '../lib/sharedStore';
import { menuEditsStore } from './menuEdits';
import { cycleEntrees, cycleItems } from './production';
import { recipeInfo, type RecipeInfo } from './recipes';
import { getSetting, serviceConfig, setSetting } from './serviceConfig';
import { venueSettingsStore } from './venueSettings';

export interface AssocMenuSettings {
  days: Record<string, DayPicks>;
  std: Record<string, string>;
  weeks: Record<string, Partial<MenuWeek>>;
  /** Associate special of the week, by the week's Monday. */
  wk: Record<string, string>;
  /** Room key of the venue that serves associates. */
  venue: string;
}

export function assocMenuSettings(): AssocMenuSettings {
  const venue = getSetting<string | undefined>('am.venue');
  return {
    days: getSetting<Record<string, DayPicks> | undefined>('am.days') ?? {},
    std: getSetting<Record<string, string> | undefined>('am.std') ?? {},
    weeks: getSetting<Record<string, Partial<MenuWeek>> | undefined>('am.weeks') ?? {},
    wk: getSetting<Record<string, string> | undefined>('am.wk') ?? {},
    venue: venue && rooms[venue] ? venue : DEFAULT_ASSOC_VENUE,
  };
}

/**
 * Re-render when anything the menu depends on changes: the settings, the
 * Recipe Book and menu cycle, or a venue's schedule.
 */
export function useAssocMenuSettings(): AssocMenuSettings {
  useShared(serviceConfig);
  useShared(menuEditsStore);
  useShared(venueSettingsStore);
  return assocMenuSettings();
}

// ─── Specials ────────────────────────────────────────────────────────────

export interface DaySpecial {
  period: 'Lunch' | 'Dinner';
  /** The entrée specials on the cycle that day: what the chef can pick from. */
  options: Array<{ recipeId: string; name: string }>;
  /** The recipe offered, or null when there is no special this meal. */
  recipe: RecipeInfo | null;
  cap: number;
  /** The chef chose (rather than the default). */
  chosen: boolean;
}

/** The special for a date's meal period: the chef's pick, else the cycle's first entrée special. */
export function daySpecial(date: string, period: 'Lunch' | 'Dinner', s: AssocMenuSettings = assocMenuSettings()): DaySpecial {
  const options = cycleEntrees(s.venue, date, period);
  const pick: DaySpecialPick = s.days[date]?.[period] ?? {};
  const recipeId = pick.recipeId === undefined ? (options[0]?.recipeId ?? null) : pick.recipeId;
  return {
    period,
    options,
    recipe: recipeId ? (recipeInfo(recipeId) ?? null) : null,
    cap: Math.max(0, Number(pick.cap ?? DEFAULT_SPECIAL_CAP) || 0),
    chosen: pick.recipeId !== undefined,
  };
}

// ─── Special of the week ─────────────────────────────────────────────────

/** The associate special of the week a date falls in, or undefined when none is set. */
export function weekSpecial(date: string, s: AssocMenuSettings = assocMenuSettings()): RecipeInfo | undefined {
  return recipeInfo(weekSpecialFor(date, s.wk));
}

function weekItem(date: string, s: AssocMenuSettings): AssocMenuItem[] {
  const r = weekSpecial(date, s);
  if (!r) return [];
  return [
    {
      id: 'am_week',
      name: r.name,
      sub: `All week${r.desc ? ` · ${r.desc}` : ''}`,
      recipeIds: [r.id],
      allergens: r.allergens ?? [],
      weekly: true,
      mods: [],
    },
  ];
}

// ─── Soup of the day ─────────────────────────────────────────────────────

/** The dining room's soup of the day for a date's meal period, from the venue's menu cycle. */
export function daySoup(date: string, period: 'Lunch' | 'Dinner', s: AssocMenuSettings = assocMenuSettings()): RecipeInfo | undefined {
  return recipeInfo(soupOfTheDay(cycleItems(s.venue, date, period), (id) => recipeInfo(id)?.sub));
}

// ─── Standing choices ────────────────────────────────────────────────────

/** The recipe behind a hand-picked standing choice: the chef's pick, else the standard one. */
export function standingRecipe(slot: StandingSlot, s: AssocMenuSettings = assocMenuSettings()): RecipeInfo | undefined {
  return recipeInfo(s.std[slot.id]) ?? recipeInfo(slot.defaultRecipe);
}

/**
 * The standing choices as menu items, named after their recipes. The soup
 * (alone and in the combo) is the given soup of the day; with no soup that
 * day, both are left off.
 */
export function standingItems(soup: RecipeInfo | undefined, s: AssocMenuSettings = assocMenuSettings()): AssocMenuItem[] {
  return STANDING_SLOTS.flatMap((slot): AssocMenuItem[] => {
    if (slot.daySoup) {
      if (!soup) return [];
      return [
        {
          id: slot.id,
          name: soup.name,
          sub: `Today's soup${soup.desc ? ` · ${soup.desc}` : ''}`,
          recipeIds: [soup.id],
          allergens: soup.allergens ?? [],
          soupOfDay: true,
          mods: slot.mods,
        },
      ];
    }
    const r = standingRecipe(slot, s);
    if (!r) return [];
    if (slot.withSoup) {
      if (!soup) return [];
      return [
        {
          id: slot.id,
          name: COMBO_NAME,
          sub: `A cup of ${soup.name.toLowerCase()} and a ${r.name.toLowerCase()}`,
          recipeIds: [soup.id, r.id],
          allergens: [...new Set([...(soup.allergens ?? []), ...(r.allergens ?? [])])],
          mods: slot.mods,
        },
      ];
    }
    return [
      {
        id: slot.id,
        name: r.name,
        sub: `${slot.label} · ${r.desc ?? ''}`.replace(/ · $/, ''),
        recipeIds: [r.id],
        allergens: r.allergens ?? [],
        mods: slot.mods,
      },
    ];
  });
}

// ─── A day's menu ────────────────────────────────────────────────────────

function specialItem(sp: DaySpecial, meal: AssocMealKind): AssocMenuItem[] {
  if (!sp.recipe) return [];
  const period = sp.period.toLowerCase();
  return [
    {
      id: 'am_special',
      name: sp.recipe.name,
      sub: `Chef's ${period} special${meal === 'NOC' ? ', from the dinner line' : ''}${sp.recipe.desc ? ` · ${sp.recipe.desc}` : ''}`,
      recipeIds: [sp.recipe.id],
      allergens: sp.recipe.allergens ?? [],
      cap: sp.cap,
      capMeals: sp.period === 'Lunch' ? ['Lunch'] : ['Dinner', 'NOC'],
      special: true,
      mods: [],
    },
  ];
}

/**
 * What associates can pick for a meal on a date: the meal period's special,
 * then the standing choices. Null when the day can't be planned (past, too
 * far out, or the week is still a draft); `anyDay` skips that check, for a
 * manager fixing an order.
 */
export function assocMenuFor(
  date: string,
  meal: AssocMealKind,
  todayIso: string,
  s: AssocMenuSettings = assocMenuSettings(),
  anyDay = false,
): AssocMenuItem[] | null {
  if (!anyDay && closedReason(date, todayIso, s.weeks)) return null;
  const period = specialPeriodOf(meal);
  return [...specialItem(daySpecial(date, period, s), meal), ...weekItem(date, s), ...standingItems(daySoup(date, period, s), s)];
}

/**
 * Every item that could be ordered on a date (both chef's specials, the
 * special of the week and the standing choices with lunch's and, when it
 * differs, dinner's soup), for lists and sorting.
 */
export function assocMenuForDay(date: string, s: AssocMenuSettings = assocMenuSettings()): AssocMenuItem[] {
  const lunch = specialItem(daySpecial(date, 'Lunch', s), 'Lunch').map((x) => ({ ...x, id: 'am_special_lunch' }));
  const dinner = specialItem(daySpecial(date, 'Dinner', s), 'Dinner').map((x) => ({ ...x, id: 'am_special_dinner' }));
  const lunchSoup = daySoup(date, 'Lunch', s);
  const dinnerSoup = daySoup(date, 'Dinner', s);
  const standing = standingItems(lunchSoup ?? dinnerSoup, s);
  const dinnerOnly =
    lunchSoup && dinnerSoup && dinnerSoup.id !== lunchSoup.id
      ? standingItems(dinnerSoup, s)
          .filter((x) => x.recipeIds.includes(dinnerSoup.id))
          .map((x) => ({ ...x, id: `${x.id}_dinner` }))
      : [];
  return [...lunch, ...dinner, ...weekItem(date, s), ...standing, ...dinnerOnly];
}

/** Find an item on a date's menu by the name an order carries. */
export function assocItemByName(date: string, meal: AssocMealKind, name: string, s: AssocMenuSettings = assocMenuSettings()): AssocMenuItem | null {
  return assocMenuFor(date, meal, date, s, true)?.find((x) => x.name === name) ?? null;
}

// ─── Back Office ─────────────────────────────────────────────────────────

/** Offer a recipe as the special (null: no special that meal; undefined: back to the cycle's first entrée). */
export function setDaySpecial(date: string, period: 'Lunch' | 'Dinner', recipeId: string | null | undefined): void {
  const cur = assocMenuSettings().days[date]?.[period] ?? {};
  const next: DaySpecialPick = { ...cur };
  if (recipeId === undefined) delete next.recipeId;
  else next.recipeId = recipeId;
  setSetting(`am.days.${date}.${period}`, next);
}

export function setDaySpecialCap(date: string, period: 'Lunch' | 'Dinner', cap: number): void {
  const cur = assocMenuSettings().days[date]?.[period] ?? {};
  setSetting(`am.days.${date}.${period}`, { ...cur, cap: Math.max(0, Math.floor(cap)) });
}

/** Swap the recipe behind a standing choice (undefined: back to the standard recipe). */
export function setStandingRecipe(slotId: string, recipeId: string | undefined): void {
  setSetting(`am.std.${slotId}`, recipeId);
}

/** Set the associate special of the week for the week starting this Monday (undefined: none). */
export function setWeekSpecial(monday: string, recipeId: string | undefined): void {
  setSetting(`am.wk.${monday}`, recipeId || undefined);
}

export function setWeekScheduled(monday: string, sched: boolean): void {
  setSetting(`am.weeks.${monday}`, { sched });
}

// ─── On the tablet ───────────────────────────────────────────────────────

const TABLET_CATEGORY: Record<string, string> = { Entrees: 'Entrées', Starters: 'Starters', Sides: 'Sides', Desserts: 'Desserts', Drinks: 'Drinks' };
const COURSE_OF: Record<string, number> = { Starters: 1, Entrees: 2, Sides: 2, Desserts: 3 };

/** A tablet item for a recipe the dining room menu doesn't carry, so it can still be rung in for an associate. */
export function recipeAsItem(r: RecipeInfo): CatalogItem {
  return {
    id: r.id,
    name: r.name,
    desc: r.desc ?? '',
    residentPrice: 0,
    guestPrice: 0,
    alaPrice: 0,
    day: 0,
    avail: null,
    mods: [],
    allergens: r.allergens ?? [],
    course: COURSE_OF[r.cat] ?? 2,
    entree: r.cat === 'Entrees',
    meal: 'Lunch',
    category: TABLET_CATEGORY[r.cat] ?? 'Entrées',
  };
}

/**
 * Make every dish on the associate menu orderable from the tablet: the
 * standing choices, the soups of the day and the next two weeks' specials
 * (chef's specials and specials of the week). A recipe the dining room menu
 * already carries keeps its own item.
 */
export function syncAssocItems(todayIso: string, s: AssocMenuSettings = assocMenuSettings()): void {
  const ids = new Set<string>();
  for (let k = 0; k < 14; k++) {
    const d = new Date(todayIso + 'T12:00:00');
    d.setDate(d.getDate() + k);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const m of assocMenuForDay(iso, s)) m.recipeIds.forEach((id) => ids.add(id));
  }
  const byName = new Set(catalog.map((i) => i.name.toLowerCase()));
  ensureItems(
    [...ids]
      .map((id) => recipeInfo(id))
      .filter((r): r is RecipeInfo => !!r && !byName.has(r.name.toLowerCase()))
      .map(recipeAsItem),
  );
}
