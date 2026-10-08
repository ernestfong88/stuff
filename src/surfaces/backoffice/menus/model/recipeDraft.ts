/**
 * AI Autofill and recipe import. These stand in for the AI service: they
 * fill only what is empty with a sensible starting point for the kind of
 * dish, and list what they filled so the chef reviews it before publishing.
 */
import type { Ingredient, Nutrition, Recipe } from '../../../../store/menuEdits';
import { isSavoryCakeOrPie, normCategory } from './categories';

type Kind = 'Beverage' | 'Appetizer' | 'Entree' | 'Side' | 'Dessert';

function kindOf(cat: string): Kind {
  const c = normCategory(cat);
  return c === 'Drinks' ? 'Beverage' : c === 'Entrees' ? 'Entree' : c === 'Sides' ? 'Side' : c === 'Desserts' ? 'Dessert' : 'Appetizer';
}

const SERVING: Record<Kind, string> = { Appetizer: '1 cup (8 fl oz)', Entree: '1 plate', Side: '5 oz', Dessert: '1 slice', Beverage: '8 fl oz' };
const NUTRITION: Record<Kind, number[]> = {
  Appetizer: [160, 6, 22, 5, 480, 3, 60],
  Entree: [430, 30, 24, 22, 560, 3, 70],
  Side: [140, 3, 20, 5, 300, 3, 40],
  Dessert: [330, 5, 46, 14, 220, 1, 90],
  Beverage: [90, 0, 22, 0, 15, 0, 20],
};

function starterIngredients(name: string, kind: Kind): Ingredient[] {
  const s = name.toLowerCase();
  if (s.includes('salmon'))
    return [
      { qty: 6, unit: 'oz', name: 'salmon fillet, skin on' },
      { qty: 1, unit: 'tbsp', name: 'olive oil' },
      { qty: 1, unit: 'tsp', name: 'herb crust blend' },
      { qty: 0.5, unit: '', name: 'lemon' },
    ];
  if (s.includes('salad'))
    return [
      { qty: 2, unit: 'cups', name: 'romaine, chopped' },
      { qty: 0.25, unit: 'cup', name: 'shaved parmesan' },
      { qty: 0.5, unit: 'cup', name: 'croutons' },
      { qty: 2, unit: 'tbsp', name: 'dressing' },
    ];
  if ((s.includes('cake') && !isSavoryCakeOrPie(s)) || kind === 'Dessert')
    return [
      { qty: 1, unit: 'slice', name: 'prepared base' },
      { qty: 1, unit: 'tbsp', name: 'garnish' },
    ];
  return [
    { qty: 6, unit: 'oz', name: 'primary protein or base' },
    { qty: 1, unit: 'tbsp', name: 'oil or butter' },
    { qty: 1, unit: 'tsp', name: 'seasoning blend' },
    { qty: 4, unit: 'oz', name: 'accompaniment' },
  ];
}

/** What AI Autofill adds to a recipe: only the parts that are empty. */
export function autofill(r: Recipe): { patch: Partial<Recipe>; filled: string[] } {
  const kind = kindOf(r.cat);
  const patch: Partial<Recipe> = {};
  const filled: string[] = [];
  if (!r.servingDesc && !r.servingSize) {
    patch.servingDesc = SERVING[kind];
    filled.push('serving');
  }
  if (!r.ingredients?.length) {
    patch.ingredients = starterIngredients(r.name, kind);
    filled.push('ingredients');
  }
  if (!r.method?.length) {
    patch.method =
      kind === 'Appetizer'
        ? ['Prep and portion all components.', 'Combine or heat to service temperature.', 'Taste, season, hold hot or cold as appropriate.']
        : [
            'Prep and measure all ingredients (mise en place).',
            'Cook the main component to temperature.',
            'Finish with sauce or seasoning; verify internal temp.',
            'Plate per photo and cook notes; serve immediately.',
          ];
    filled.push('method');
  }
  if (!r.nutrition || !Object.keys(r.nutrition).length) {
    const [calories, protein, carbs, fat, sodium, fiber, calcium] = NUTRITION[kind];
    patch.nutrition = { calories, protein, carbs, fat, sodium, fiber, calcium } satisfies Nutrition;
    filled.push('nutrition');
  }
  if (!r.menuDescriptor && !r.desc) {
    patch.menuDescriptor = r.name;
    filled.push('menu descriptor');
  }
  if (!r.cookNotes && kind === 'Entree') {
    patch.cookNotes = 'Plate per standard; sauce under, protein centered, wipe the rim.';
    filled.push('cook notes');
  }
  if (filled.length) patch.aiDrafted = [...new Set([...(r.aiDrafted ?? []), ...filled])];
  return { patch, filled };
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
const LINE = /^(\d+(?:[./]\d+)?|½|¼|¾)\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|lbs?|pounds?|oz|ounces?|cloves?|cans?|sprigs?|g|kg|ml|l)?\s*(.+)$/i;

function qtyOf(s: string): number {
  if (FRACTIONS[s] != null) return FRACTIONS[s];
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number);
    return b ? a / b : a;
  }
  return Number(s);
}

/** Read a pasted recipe: ingredient lines, method steps and the yield. */
export function parseRecipeText(text: string): Pick<Recipe, 'ingredients' | 'method' | 'baseServings' | 'aiDrafted'> {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const ingredients: Ingredient[] = [];
  const method: string[] = [];
  for (const raw of lines) {
    const l = raw.replace(/^[-•*]\s*/, '');
    const m = LINE.exec(l);
    if (m && raw.length < 70 && !/^\d+\./.test(raw)) {
      ingredients.push({
        qty: qtyOf(m[1]),
        unit: (m[2] ?? '')
          .toLowerCase()
          .replace(/tablespoons?/, 'tbsp')
          .replace(/teaspoons?/, 'tsp')
          .replace(/pounds?/, 'lb'),
        name: m[3],
      });
    } else if (raw.length > 15) method.push(raw.replace(/^\d+[.)]\s*/, ''));
  }
  const y = /(?:serves|servings?|yield)\D{0,10}(\d+)/i.exec(text);
  return {
    ingredients,
    method,
    baseServings: y ? +y[1] : 6,
    aiDrafted: ['serving', ...(ingredients.length ? ['ingredients'] : []), ...(method.length ? ['method'] : [])],
  };
}

/** What AI reads from an uploaded recipe card (stands in for reading the photo). */
export function photoDraft(): Pick<Recipe, 'ingredients' | 'method' | 'baseServings' | 'aiDrafted'> {
  return {
    aiDrafted: ['ingredients', 'method', 'serving'],
    ingredients: [
      { qty: 2, unit: 'lb', name: 'ground beef 80/20 (read from photo)' },
      { qty: 1, unit: 'cup', name: 'breadcrumbs (read from photo)' },
      { qty: 2, unit: '', name: 'eggs (read from photo)' },
    ],
    method: ['Combine, do not overmix.', 'Form loaf; bake 350°F 45 min.', 'Rest 10 min before slicing.'],
    baseServings: 8,
  };
}

/**
 * Ingredients guessed from a short description ("salmon over lemon orzo
 * with asparagus"), for the AI Assist new-recipe dialog.
 */
export function ingredientsFromAbout(about: string): Ingredient[] {
  return about
    .toLowerCase()
    .replace(/[.!?]/g, ',')
    .split(/,|;|\bwith\b|\band\b|\bover\b|\bon\b|\btopped\b|\bserved\b/)
    .map((x) =>
      x.trim().replace(/^((sliced|diced|chopped|shredded|grilled|roasted|baked|fried|seared|steamed|hot|warm|cold|crispy|fresh|house|homemade)\s+)+/, ''),
    )
    .filter(
      (x) =>
        x.length > 2 &&
        x.length < 34 &&
        !/^(a|an|the|light|not|no|very|it|served|serve|sliced|diced|chopped|shredded|grilled|roasted|baked|fried|seared|steamed|hot|warm|cold|crispy|fresh)\b/.test(
          x,
        ),
    )
    .slice(0, 10)
    .map((name) => ({ qty: 1, unit: '', name }));
}

// ─── Quantities ───────────────────────────────────────────────────────────

const FRACTION_GLYPHS: Array<[number, string]> = [
  [0, ''],
  [0.125, '⅛'],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.375, '⅜'],
  [0.5, '½'],
  [0.625, '⅝'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
  [0.875, '⅞'],
  [1, ''],
];

/** 0.25 → "¼", 1.5 → "1 ½", 22.5 → "22.5". */
export function fraction(v: number): string {
  if (v == null || isNaN(v)) return '';
  if (v >= 20) return String(Math.round(v * 10) / 10).replace(/\.0$/, '');
  const whole = Math.floor(v + 1e-9);
  const part = v - whole;
  const best = FRACTION_GLYPHS.reduce((x, y) => (Math.abs(y[0] - part) < Math.abs(x[0] - part) ? y : x));
  if (Math.abs(best[0] - part) > 0.04) return String(Math.round(v * 100) / 100);
  const w = best[0] === 1 ? whole + 1 : whole;
  return best[1] ? (w ? w + ' ' : '') + best[1] : String(w);
}

/** Quantity and unit for a scaled recipe, moving to a bigger unit when it reads better (3 tsp → 1 tbsp). */
export function qtyUnit(q: number, unit: string, convert: boolean): string {
  let u = (unit || '').trim();
  let v = q;
  const clean = (x: number) => x >= 20 || FRACTION_GLYPHS.some(([f]) => Math.abs(x - Math.floor(x) - f) < 0.04);
  const step = (from: string, to: string, div: number, min: number) => {
    if (u.toLowerCase() === from && v >= min && clean(v / div)) {
      v /= div;
      u = to;
    }
  };
  if (convert) {
    step('tsp', 'tbsp', 3, 3);
    step('tbsp', 'cup', 16, 4);
    step('fl oz', 'cup', 8, 8);
    step('cup', 'qt', 4, 4);
    step('qt', 'gal', 4, 4);
    step('oz', 'lb', 16, 16);
  }
  return fraction(v) + (u ? ' ' + u : '');
}

/** "1 hr 5 min", "35 min", "–" */
export function minutesText(m: number | undefined): string {
  if (!m) return '–';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? h + ' hr' + (mm ? ' ' + mm + ' min' : '') : mm + ' min';
}

// ─── Menu descriptor wording ──────────────────────────────────────────────

const OR_OK = new Set(['more or less', 'with or without', 'whether or not', 'sooner or later', 'one or two', 'two or three', 'rain or shine', 'now or never']);

/**
 * Words in a menu descriptor that read as a choice ("your choice of",
 * "chicken or shrimp"). A descriptor says how the dish comes by default;
 * options belong in a pinned modifier group.
 */
export function choiceWords(s: string): string | null {
  const m = s.match(/\b(?:choices? of|your choice|with a choice|your way|select|pick|choose)\b/i);
  if (m) return m[0];
  for (const x of s.matchAll(/\b([a-z][a-z'-]*)\s+or\s+([a-z][a-z'-]*)/gi)) {
    const ph = x[0].toLowerCase().replace(/\s+/g, ' ');
    if (OR_OK.has(ph) || /^so$/i.test(x[2])) continue;
    return x[0];
  }
  return null;
}
