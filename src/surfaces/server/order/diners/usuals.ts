/**
 * A resident's usuals on their diner card: drinks first (servers write
 * drinks down and fetch them before anything else), then food. They belong
 * to the meal being served, a breakfast omelet is no help at dinner, and
 * each carries the way the resident has it, so one tap orders it right.
 *
 * Learned history comes first. The rest is filler, stable per resident and
 * meal, so every demo table has something believable to tap; the real
 * thing would come from order history alone.
 */
import { menu } from '../../../../data';
import { hash } from '../../../../domain/courses';
import { isDrink } from '../../../../domain/menu';
import type { LearnedFavorite } from '../../../../domain/orders';
import type { MealName, MenuItem, ModSelection, Resident } from '../../../../domain/types';
import { getItem } from '../../../../data';
import { isToday } from '../menu/menuCatalog';

export interface Usual {
  item: MenuItem;
  mods: ModSelection;
  note: string;
  /** Times ordered, for learned usuals. */
  n?: number;
}

const MEAT = /(beef|steak|chicken|pork|\bham\b|bacon|sausage|turkey|lamb|veal|meatball|bolognese|burger|brisket|prosciutto|pepperoni|salami|hot dog|\bdeli\b|seafood|\bblt\b|sushi|\bribs?\b|salmon|fish|flounder|shrimp|crab|tuna|\bcod\b|halibut|scallop|lobster|anchov)/i;
const MULTI = new Set(['Fillings', 'Add']);
const FAV_STOPWORDS =
  /^(meat|with|from|always|wants|whenever|first|every|everything|loves|good|after|before|anything|black|small|warm|light|eater|particular|about|things|cooked|option|sometimes|watches|free|gluten|decaf|special|former|chef)$/;

function defaults(it: MenuItem): ModSelection {
  const md: ModSelection = {};
  for (const g of it.mods ?? []) if (g.default) md[g.group] = g.default;
  return md;
}

/** __kUsualDrinks: three drinks per resident, stable for the demo. */
function fillerDrinks(r: Resident, meal: MealName): MenuItem[] {
  const g = menu[meal] ?? {};
  const pool = [...(g.Drinks ?? []), ...(g.Beverages ?? [])];
  if (!pool.length) return [];
  const h = hash(String(r.id));
  const used = new Set<number>();
  const out: MenuItem[] = [];
  for (let i = 0; i < 3 && i < pool.length; i++) {
    let ix = (h + i * 7) % pool.length;
    while (used.has(ix)) ix = (ix + 1) % pool.length;
    used.add(ix);
    out.push(pool[ix]);
  }
  return out;
}

/** __kUsualWay: a stable "usual way" for each choice on the item. */
function usualWay(it: MenuItem, seed: string): ModSelection {
  const md: ModSelection = {};
  for (const g of it.mods ?? []) {
    const o = g.opts ?? [];
    if (g.group === 'Notes' || !o.length) continue;
    const h = hash(`${seed}|${it.id}|${g.group}`);
    if (MULTI.has(g.group)) {
      const a = o[h % o.length];
      const b = o[(h >>> 5) % o.length];
      md[g.group] = a === b ? [a] : [a, b];
    } else md[g.group] = o[h % o.length];
  }
  return md;
}

const dropMeat = (md: ModSelection): ModSelection => {
  const out: ModSelection = {};
  for (const [k, v] of Object.entries(md)) {
    if (Array.isArray(v)) {
      const kept = v.filter((y) => !MEAT.test(y));
      if (kept.length) out[k] = kept;
    } else if (!MEAT.test(v)) out[k] = v;
  }
  return out;
};

/** __kUsuals: up to three drinks and two dishes for this meal. */
export function usualsFor(r: Resident, meal: MealName, learned: LearnedFavorite[]): { drinks: Usual[]; food: Usual[] } {
  const g = menu[meal] ?? {};
  const sideIds = new Set((g.Sides ?? []).map((x) => x.id));
  const known: Usual[] = learned.flatMap((f) => {
    const item = getItem(f.itemId);
    return item && isToday(item) && !sideIds.has(item.id) ? [{ item, mods: f.mods ?? {}, note: f.note ?? '', n: f.n }] : [];
  });

  const drinks = known.filter((x) => isDrink(x.item.id)).slice(0, 3);
  for (const it of fillerDrinks(r, meal)) {
    if (drinks.length < 3 && !drinks.some((x) => x.item.id === it.id)) drinks.push({ item: it, mods: defaults(it), note: '' });
  }

  const food = known.filter((x) => !isDrink(x.item.id)).slice(0, 3);
  if (food.length < 2) {
    const veg = /no meat|vegetarian|vegan/i.test([r.fav, ...(r.diet ?? [])].join(' '));
    const way = (it: MenuItem) => (veg ? dropMeat(usualWay(it, r.id)) : usualWay(it, r.id));
    const avoid = [...(r.allergies ?? []), ...(r.diet ?? [])].join(' ').toLowerCase();
    const safe = (it: MenuItem) => !(it.allergens ?? []).some((a) => avoid.includes(String(a).toLowerCase()));
    const all = ['Specials', 'Entrées']
      .flatMap((k) => g[k] ?? [])
      .filter((it) => isToday(it) && safe(it) && !food.some((x) => x.item.id === it.id) && !(veg && MEAT.test(it.name + ' ' + (it.desc || ''))));
    const withChoices = all.filter((it) => (it.mods ?? []).some((m) => m.group !== 'Notes' && (m.opts ?? []).length));
    const pool = withChoices.length >= 4 ? withChoices : all;
    const favWords = ((r.fav || '').toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !FAV_STOPWORDS.test(w));
    const hit = all.find((it) => favWords.some((w) => it.name.toLowerCase().includes(w)));
    if (hit) food.push({ item: hit, mods: way(hit), note: '' });
    let h = hash(String(r.id) + meal);
    const used = new Set<number>();
    for (let i = 0; food.length < 2 && used.size < pool.length; i++) {
      const ix = (h + i * 5) % pool.length;
      if (used.has(ix)) {
        h++;
        continue;
      }
      used.add(ix);
      if (!food.some((x) => x.item.id === pool[ix].id)) food.push({ item: pool[ix], mods: way(pool[ix]), note: '' });
    }
  }
  return { drinks, food };
}
