/**
 * Import a recipe from the text of a file (Word, plain text, Markdown, RTF).
 * A plain reader, not AI: it finds the title, the yield and times, the
 * sections by their headings (or by how the lines look when there are none),
 * and splits ingredient lines into amount, unit and name. Lines it can't
 * place are returned so the chef sees them and nothing is lost.
 */
import { inferAllergens, type AllergenKey } from '../../../../domain/allergens';
import type { Ingredient, Recipe } from '../../../../store/menuEdits';
import { guessCategory, guessSubcategory } from './categories';
import { autofill, photoDraft } from './recipeDraft';

/** What the import found, ready for the chef to check before saving. */
export interface ImportDraft {
  recipe: Omit<Recipe, 'id'>;
  /** Lines the reader couldn't place, in file order. */
  unplaced: string[];
  /** Allergens read from the name, description and ingredients; not confirmed. */
  suggestedAllergens: AllergenKey[];
}

type Section = 'header' | 'ingredients' | 'method' | 'plating' | 'notes' | 'garnish' | 'equipment' | 'description';

const HEADINGS: Array<[Exclude<Section, 'header'>, RegExp]> = [
  ['ingredients', /^(?:ingredients?|ingredient list|what you(?:'ll| will)? need)$/i],
  [
    'method',
    /^(?:method|directions?|instructions?|steps|preparation|procedure|how to make(?: it)?|to make|cooking (?:instructions|method)|prep(?:aration)? steps)$/i,
  ],
  ['plating', /^(?:plating|presentation|to serve|serving|assembly|to plate|plate up|service)$/i],
  ['garnish', /^(?:garnish(?:es)?|to garnish)$/i],
  ['equipment', /^(?:equipment|tools|utensils|smallwares)$/i],
  ['notes', /^(?:notes?|chef'?s notes?|cook'?s notes?|tips?|storage|variations?|make ahead)$/i],
  ['description', /^(?:description|about(?: this recipe)?|introduction|intro|summary)$/i],
];

// ─── Quantities and units ─────────────────────────────────────────────────

const GLYPHS: Record<string, number> = {
  '½': 1 / 2,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};
const G = '[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]';
/** 1 1/2 · 1½ · 1 ½ · 1/2 · ½ · 0.5 · .5 · 2 */
const Q = `(?:\\d+\\s+\\d+\\s*[/⁄]\\s*\\d+|\\d+\\s*${G}|\\d+\\s*[/⁄]\\s*\\d+|${G}|\\d*\\.\\d+|\\d+)`;
/** A quantity, or a range of them (the first is kept). */
const QR = `(${Q})(?:\\s*(?:-|–|—|to|or)\\s*${Q})?`;

/** "1 1/2" → 1.5, "1½" → 1.5, "0.5" → 0.5. */
export function parseQty(s: string): number {
  const t = s.trim().replace(/⁄/g, '/');
  let m = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) return +m[1] + (+m[3] ? +m[2] / +m[3] : 0);
  m = new RegExp(`^(\\d+)\\s*(${G})$`).exec(t);
  if (m) return +m[1] + GLYPHS[m[2]];
  m = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) return +m[2] ? +m[1] / +m[2] : +m[1];
  if (GLYPHS[t] != null) return GLYPHS[t];
  return Number(t);
}

/** Unit spellings → the unit the Recipe Book uses. */
const UNITS: Array<[string, RegExp]> = [
  ['fl oz', /^(?:fl\.?\s*oz\.?|fluid\s+ounces?)/i],
  ['tbsp', /^(?:tablespoons?|tbsps?\.?|tbl\.?|tbs\.?)/i],
  ['tsp', /^(?:teaspoons?|tsps?\.?)/i],
  ['cup', /^(?:cups?|c\.)/i],
  ['oz', /^(?:ounces?|oz\.?)/i],
  ['lb', /^(?:pounds?|lbs?\.?)/i],
  ['kg', /^(?:kilograms?|kilos?|kgs?\.?)/i],
  ['g', /^(?:grams?|gr?\.?)/i],
  ['ml', /^(?:millilit(?:er|re)s?|mls?\.?)/i],
  ['l', /^(?:lit(?:er|re)s?|l\.?)/i],
  ['qt', /^(?:quarts?|qts?\.?)/i],
  ['pt', /^(?:pints?|pts?\.?)/i],
  ['gal', /^(?:gallons?|gal\.?)/i],
  ['each', /^(?:each|ea\.?)/i],
  ['clove', /^cloves?/i],
  ['pinch', /^pinch(?:es)?/i],
  ['dash', /^dash(?:es)?/i],
  ['can', /^cans?/i],
  ['sprig', /^sprigs?/i],
  ['bunch', /^bunch(?:es)?/i],
  ['slice', /^slices?/i],
  ['stalk', /^stalks?/i],
  ['head', /^heads?/i],
  ['stick', /^sticks?/i],
  ['package', /^(?:packages?|pkgs?\.?)/i],
  ['handful', /^handfuls?/i],
  // Recipe-card shorthand: capital T is a tablespoon, small t a teaspoon.
  ['tbsp', /^T\.?/],
  ['tsp', /^t\.?/],
  ['cup', /^c/i],
];

const COUNTED = new Set(['clove', 'pinch', 'dash', 'can', 'sprig', 'bunch', 'slice', 'stalk', 'head', 'stick', 'package', 'handful']);
const PLURAL: Record<string, string> = { pinch: 'pinches', dash: 'dashes', bunch: 'bunches' };

function unitAt(s: string): [string, string] | null {
  for (const [unit, re] of UNITS) {
    const m = re.exec(s);
    if (!m) continue;
    const rest = s.slice(m[0].length);
    // The unit must be a whole word: "2 large eggs" has no unit.
    if (rest && !/^[\s,;)]/.test(rest)) continue;
    return [unit, rest];
  }
  return null;
}

const ING = new RegExp(`^${QR}\\s*(\\([^)]*\\))?\\s*(.*)$`);
/** Words that make "20 minutes, stirring" a step, not an ingredient. */
const NOT_ING = /^(?:min(?:ute)?s?|hours?|hrs?|seconds?|secs?|degrees?|°|times?|more|minutes?)\b|°[CF]?|\buntil\b/i;

/** "1½ cups flour, sifted" → { qty: 1.5, unit: 'cup', name: 'flour, sifted' }; null when it doesn't start with an amount. */
export function parseIngredientLine(line: string): Ingredient | null {
  const m = ING.exec(stripMarker(line).text);
  if (!m) return null;
  const qty = parseQty(m[1]);
  if (!isFinite(qty)) return null;
  const size = m[2]?.trim();
  let rest = m[3].trim();
  let unit = '';
  const u = unitAt(rest);
  if (u) {
    // Counted units read as plural above one: "3 cloves garlic".
    unit = qty > 1 && COUNTED.has(u[0]) ? (PLURAL[u[0]] ?? u[0] + 's') : u[0];
    rest = u[1].trim();
  }
  rest = rest.replace(/^of\s+/i, '').replace(/^[,;]\s*/, '');
  if (!rest || NOT_ING.test(rest)) return null;
  return { qty, unit, name: size ? `${rest} ${size}` : rest };
}

// ─── Times and yield ──────────────────────────────────────────────────────

const DURATION = new RegExp(
  `^(?:about|approx\\.?|approximately|~)?\\s*(?:${QR}\\s*(?:h|hrs?|hours?)\\.?)?\\s*(?:and\\s*)?(?:${QR}\\s*(?:m|mins?|minutes?)\\.?)?$`,
  'i',
);

/** "1 hr 15 min" → 75, "45 minutes" → 45, "1½ hours" → 90; null when it isn't only a time. */
export function parseDuration(s: string): number | null {
  const m = DURATION.exec(s.trim());
  if (!m || (!m[1] && !m[2])) return null;
  return Math.round((m[1] ? parseQty(m[1]) * 60 : 0) + (m[2] ? parseQty(m[2]) : 0));
}

const META =
  /^(prep(?:aration)?|cook(?:ing)?|bake|baking|roast(?:ing)?|total|active|inactive|serves|servings?|yields?|makes|portions?|serving size|portion size)(\s+time)?\s*([:\-–]?)\s*(.*)$/i;

interface Meta {
  prepMin?: number;
  cookMin?: number;
  baseServings?: number;
  servingDesc?: string;
}

/**
 * The yield and times on a line like "Prep 20 min | Cook 1 hr | Serves 8".
 * In the method, "Bake 45 minutes" is a step, so there it needs "time" or a colon.
 */
function readMeta(line: string, strict: boolean): { meta: Meta; left: string[] } | null {
  const chunks = line
    .split(/\s*[|·•;\t]\s*|\s{2,}|,\s*(?=(?:prep|cook|bake|total|active|serves|servings|yield|makes)\b)/i)
    .map((c) => c.trim())
    .filter(Boolean);
  const meta: Meta = {};
  const left: string[] = [];
  let hits = 0;
  for (const c of chunks) {
    const m = META.exec(c);
    if (!m || (strict && !m[2] && !m[3])) {
      left.push(c);
      continue;
    }
    const label = m[1].toLowerCase();
    const rest = m[4].trim();
    if (/size/.test(label)) {
      if (!rest) {
        left.push(c);
        continue;
      }
      meta.servingDesc = rest;
    } else if (/^(serves|serving|yield|makes|portion)/.test(label)) {
      const n = /(\d+)\s*(?:servings|portions|people|guests)/i.exec(rest) ?? new RegExp(`^(?:about|approx\\.?|up to)?\\s*${QR}`, 'i').exec(rest);
      if (!n || rest.length > 40) {
        left.push(c);
        continue;
      }
      meta.baseServings = Math.round(parseQty(n[1]));
    } else {
      const min = parseDuration(rest);
      if (min == null) {
        left.push(c);
        continue;
      }
      if (label.startsWith('prep')) meta.prepMin = min;
      else if (/^(cook|bak|roast)/.test(label)) meta.cookMin = min;
      // Total and active time aren't kept on a recipe; the chef sees them in "Didn't recognise".
      else left.push(c);
    }
    hits++;
  }
  return hits ? { meta, left } : null;
}

// ─── Lines ────────────────────────────────────────────────────────────────

/** Strip Markdown and list markers: "## Method" → "Method", "3. Stir" → "Stir" (numbered). */
function stripMarker(raw: string): { text: string; numbered: boolean; bullet: boolean } {
  let t = raw
    .trim()
    .replace(/^>\s*/, '')
    .replace(/^#{1,6}\s*/, '');
  let numbered = false;
  let bullet = false;
  const step = /^step\s*\d+\s*[.):\-–]?\s*|^\d+[.)]\s+/i.exec(t);
  if (step) {
    t = t.slice(step[0].length);
    numbered = true;
  } else {
    const b = /^(?:[-*+•·◦▪▫‣○●□■–—]|\[[ xX]?\])\s+/.exec(t);
    if (b) {
      t = t.slice(b[0].length);
      bullet = true;
    }
  }
  t = t.replace(/(\*\*|__)(.+?)\1/g, '$2').trim();
  return { text: t, numbered, bullet };
}

function headingOf(line: string): { section: Exclude<Section, 'header'>; rest: string } | null {
  const t = stripMarker(line)
    .text.replace(/\*\*|__/g, '')
    .trim();
  const m = /^([^:]{2,40}?)\s*(?::\s*(.*))?$/.exec(t);
  if (!m) return null;
  const head = m[1].trim().replace(/^for the\s+/i, '');
  for (const [section, re] of HEADINGS) if (re.test(head)) return { section, rest: (m[2] ?? '').trim() };
  return null;
}

/** "By Chef Ana", "Source: …", "Adapted from …" */
const BYLINE = /^(?:by|from|source|adapted from|recipe (?:by|from)|courtesy of)\b/i;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const titleCase = (s: string) =>
  s === s.toUpperCase() && /[A-Z]/.test(s) ? s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, a: string, c: string) => a + c.toUpperCase()) : s;

/** "lemon-bars_v2.docx" → "Lemon Bars V2"; "IMG_2041.jpg" → "". */
export function nameFromFile(file: string): string {
  const base = file
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!/[a-z]{3}/i.test(base) || /^(?:img|dsc|pxl|photo|image|scan|screenshot|document|untitled)\b/i.test(base)) return '';
  return base.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Read a recipe out of text. `fallbackName` names it when the text has no title (the file name, say). */
export function parseRecipeDoc(text: string, fallbackName = ''): ImportDraft {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim());
  const headed = lines.some((l) => headingOf(l));
  const meta: Meta = {};
  const ingredients: Ingredient[] = [];
  const method: string[] = [];
  const plating: string[] = [];
  const equipment: string[] = [];
  const garnish: string[] = [];
  const notes: string[] = [];
  const desc: string[] = [];
  const unplaced: string[] = [];
  let title = '';
  let section: Section = 'header';
  let first = true;
  let last: 'ing' | 'step' | 'desc' | null = null;

  const addStep = (list: string[], raw: string) => {
    const { text: t, numbered, bullet } = stripMarker(raw);
    if (!t) return;
    const prev = list.length - 1;
    // A wrapped line carries on the step above it.
    if (!numbered && !bullet && prev >= 0 && (/^[a-z(]/.test(t) || !/[.!?:)]$/.test(list[prev]))) list[prev] += ' ' + t;
    else list.push(t);
  };

  const place = (raw: string) => {
    const { text: t, numbered, bullet } = stripMarker(raw);
    if (!t) return;
    // The yield and times can sit anywhere: under the title, or in a list of their own.
    const strict = section === 'method' || section === 'plating' || section === 'notes';
    const mt = readMeta(t, strict);
    if (mt) {
      Object.assign(meta, mt.meta);
      unplaced.push(...mt.left);
      return;
    }
    switch (section) {
      case 'ingredients': {
        const ing = parseIngredientLine(t);
        if (ing) ingredients.push(ing);
        else if (t.endsWith(':') || t.length > 70) unplaced.push(t);
        // "Salt and pepper, to taste" has no amount.
        else ingredients.push({ qty: 0, unit: '', name: t });
        return;
      }
      case 'method':
        return addStep(method, raw);
      case 'plating':
        return addStep(plating, raw);
      case 'notes':
        notes.push(t);
        return;
      case 'garnish':
        garnish.push(t);
        return;
      case 'equipment':
        equipment.push(...(bullet || numbered ? [t] : t.split(/\s*[,;]\s*/)).filter(Boolean));
        return;
      case 'description':
        desc.push(t);
        return;
    }
    // Before any heading, or a file with no headings at all.
    const ing = !numbered && t.length < 80 ? parseIngredientLine(t) : null;
    if (headed) {
      // A byline or source isn't the description.
      if (words(t) >= 4 && !ing && !BYLINE.test(t)) desc.push(t);
      else unplaced.push(t);
      return;
    }
    if (numbered) {
      addStep(method, raw);
      last = 'step';
    } else if (ing && words(t) <= 12 && !/[.!?]$/.test(t)) {
      ingredients.push(ing);
      last = 'ing';
    } else if (bullet && last === 'ing' && t.length <= 40) {
      ingredients.push({ qty: 0, unit: '', name: t });
    } else if (words(t) >= 4) {
      if (!ingredients.length && !method.length) {
        desc.push(t);
        last = 'desc';
      } else {
        if (last === 'step') addStep(method, raw);
        else method.push(t);
        last = 'step';
      }
    } else unplaced.push(t);
  };

  for (const raw of lines) {
    const h = headingOf(raw);
    if (h) {
      section = h.section;
      first = false;
      if (h.rest) {
        if (section === 'ingredients' && /,/.test(h.rest) && !parseIngredientLine(h.rest)) h.rest.split(/\s*,\s*/).forEach(place);
        else place(h.rest);
      }
      continue;
    }
    if (first) {
      first = false;
      const t = stripMarker(raw).text.replace(/^(?:recipe|title|name)\s*:\s*/i, '');
      // The first line is the title, unless it is already part of the recipe.
      if (t.length <= 80 && !readMeta(t, false) && !parseIngredientLine(t) && !stripMarker(raw).numbered) {
        title = titleCase(t.replace(/[:.]$/, ''));
        continue;
      }
    }
    place(raw);
  }

  const name = title || fallbackName.trim() || 'Imported recipe';
  const cat = guessCategory(name);
  const descText = desc.join(' ');
  const recipe: Omit<Recipe, 'id'> = {
    name,
    cat,
    sub: guessSubcategory(cat, name) || undefined,
    desc: descText,
    ...meta,
    ingredients,
    method,
    ...(plating.length ? { plating } : {}),
    ...(equipment.length ? { equipment } : {}),
    ...(garnish.length ? { garnish: garnish.join(', ') } : {}),
    ...(notes.length ? { cookNotes: notes.join('\n') } : {}),
  };
  return { recipe, unplaced, suggestedAllergens: inferAllergens({ name, desc: descText, ingredients }) };
}

/**
 * A photo or a PDF: reading those needs the AI service, so the demo fills
 * a sample from the app's stand-in AI for the chef to edit. The draft is
 * marked AI drafted, so it shows as unreviewed until a chef checks it.
 */
export function sampleFromPhoto(name: string): ImportDraft {
  const n = name.trim();
  // With no dish name to go on, the stand-in reads the sample recipe card.
  const base: Omit<Recipe, 'id'> = n ? { name: n, cat: guessCategory(n), desc: '' } : { name: 'Meatloaf', cat: 'Entrees', desc: '', ...photoDraft() };
  const { patch, filled } = autofill({ id: 'import', ...base });
  const recipe: Omit<Recipe, 'id'> = {
    ...base,
    sub: guessSubcategory(base.cat, base.name) || undefined,
    ...patch,
    aiDrafted: [...new Set([...(base.aiDrafted ?? []), ...filled])],
  };
  return { recipe, unplaced: [], suggestedAllergens: inferAllergens(recipe) };
}
