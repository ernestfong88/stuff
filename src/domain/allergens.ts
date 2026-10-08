/**
 * Food safety: what a person must avoid, what a dish contains, and where
 * the two meet.
 *
 * Allergies and diets come from the care app as free text ("MUSSELS, OR
 * CLAMS", "Gluten allergy", "No Dairy, Avoid Soy (Sensitivity)"), and dishes
 * carry tags in two vocabularies (the Recipe Book's Milk and Wheat, the
 * tablet's Dairy and Gluten). Both sides are turned into the same keys before
 * they are compared, so a warning never depends on two strings matching.
 *
 * A dish with no allergens recorded is read from its name, description and
 * ingredients instead. Those are suggestions (`inferred`): a chef confirms
 * them in the Recipe Book, and screens say "may contain".
 */

/** The nine major allergens, named as the Recipe Book names them. */
export const ALLERGEN_KEYS = [
  "Milk",
  "Egg",
  "Fish",
  "Shellfish",
  "Tree nuts",
  "Peanuts",
  "Wheat",
  "Soy",
  "Sesame",
] as const;
export type AllergenKey = (typeof ALLERGEN_KEYS)[number];
/** What a person can avoid: an allergen, or meat for a vegetarian diet. */
export type AvoidKey = AllergenKey | "Meat";

/** How each key reads in a sentence ("Contains dairy"). */
const KEY_LABEL: Record<AvoidKey, string> = {
  Milk: "Dairy",
  Egg: "Egg",
  Fish: "Fish",
  Shellfish: "Shellfish",
  "Tree nuts": "Tree nuts",
  Peanuts: "Peanuts",
  Wheat: "Gluten",
  Soy: "Soy",
  Sesame: "Sesame",
  Meat: "Meat",
};

export const avoidLabel = (k: AvoidKey): string => KEY_LABEL[k];

// ─── Tags on dishes ──────────────────────────────────────────────────────

/** A dish's allergen tag in either vocabulary → its key ("Dairy" is Milk, "Gluten" is Wheat). */
export function allergenKey(tag: string): AllergenKey | null {
  const t = tag.trim().toLowerCase();
  if (/^(milk|dairy|lactose)$/.test(t)) return "Milk";
  if (/^eggs?$/.test(t)) return "Egg";
  if (/^fish$/.test(t)) return "Fish";
  if (/^(shellfish|crustaceans?|molluscs?|mollusks?)$/.test(t))
    return "Shellfish";
  if (/^tree ?nuts?$/.test(t)) return "Tree nuts";
  if (/^peanuts?$/.test(t)) return "Peanuts";
  if (/^(wheat|gluten)$/.test(t)) return "Wheat";
  if (/^(soy|soya|soybeans?)$/.test(t)) return "Soy";
  if (/^sesame$/.test(t)) return "Sesame";
  return null;
}

// ─── A person's allergies and diets ──────────────────────────────────────

/** Phrases that look like dairy but aren't (almond milk, peanut butter, butternut squash). */
const NOT_DAIRY =
  /(almond|oat|soy|rice|coconut|cashew) milk|peanut butter|apple butter|cocoa butter|cream soda|cream of wheat|butternut|non[- ]?dairy|dairy[- ]free/gi;

/** "nut" or "nuts" on its own. */
const BARE_NUTS = /(^|[^a-z])nuts?([^a-z]|$)/i;

/**
 * Words in a care note that name an allergen. Grouping matters as much as
 * spelling: mussels, clams and crab are all Shellfish to a cook.
 */
const PERSON_WORDS: ReadonlyArray<[RegExp, AllergenKey[]]> = [
  [/dairy|\bmilk|lactose|casein|whey|\bcheese|\bcream\b|\bbutter\b/i, ["Milk"]],
  [/\beggs?\b|egg whites?|egg yolks?|\bmayo/i, ["Egg"]],
  [
    /\bfish\b|finfish|salmon|\btuna\b|\bcod\b|halibut|tilapia|trout|flounder|anchov|sardine/i,
    ["Fish"],
  ],
  [
    /shell ?fish|crustacean|mollus|shrimp|prawn|\bcrabs?\b|krab|lobster|mussel|\bclams?\b|oyster|scallop|crawfish|crayfish|langoustine|squid|calamari|octopus/i,
    ["Shellfish"],
  ],
  [
    /tree ?nuts?|almond|pecan|walnut|cashew|pistachio|hazelnut|filbert|macadamia|brazil nut|pine ?nuts?/i,
    ["Tree nuts"],
  ],
  [/peanut|groundnut|arachis/i, ["Peanuts"]],
  // "Nut allergy" with no kind given: avoid both.
  [BARE_NUTS, ["Tree nuts", "Peanuts"]],
  [/gluten|wheat|celiac|coeliac|\bbarley\b|\brye\b|\bflour\b/i, ["Wheat"]],
  [/\bsoy|soya|\btofu|edamame/i, ["Soy"]],
  [/sesame|tahini/i, ["Sesame"]],
];

/** Diets that rule out whole groups of food. */
const DIET_WORDS: ReadonlyArray<[RegExp, AvoidKey[]]> = [
  [/\bvegan\b/i, ["Meat", "Fish", "Shellfish", "Milk", "Egg"]],
  [/vegetarian|no meat|meatless/i, ["Meat", "Fish", "Shellfish"]],
  [/pescatarian|pescetarian/i, ["Meat"]],
];

/** Nut words that are not "nuts" in general (a tree nut allergy is not a peanut allergy). */
const NAMED_NUTS =
  /tree ?nuts?|peanuts?|pine ?nuts?|brazil nuts?|coconuts?|nutmeg|butternut|doughnuts?|donuts?/gi;

/** The allergen keys a piece of free text names ("MUSSELS, OR CLAMS" → Shellfish). */
export function allergenKeysIn(text: string): AllergenKey[] {
  const out = new Set<AllergenKey>();
  const plain = text.replace(NOT_DAIRY, (m) =>
    /peanut/i.test(m) ? "peanut" : " ",
  );
  for (const [re, keys] of PERSON_WORDS) {
    if (re.test(re === BARE_NUTS ? plain.replace(NAMED_NUTS, " ") : plain))
      keys.forEach((k) => out.add(k));
  }
  return ALLERGEN_KEYS.filter((k) => out.has(k));
}

export interface Avoid {
  key: AvoidKey;
  /** An allergy on file, or a diet that rules the food out. */
  kind: "allergy" | "diet";
}

export interface AvoidSource {
  allergies?: readonly string[] | null;
  diet?: readonly string[] | null;
}

/**
 * Everything a person must avoid, from their allergies and diets. An allergy
 * outranks a diet for the same food (Beatrice has both a gluten allergy and a
 * gluten-free diet: it reads as an allergy).
 */
export function personAvoids(p: AvoidSource | null | undefined): Avoid[] {
  if (!p) return [];
  const by = new Map<AvoidKey, Avoid["kind"]>();
  for (const a of p.allergies ?? [])
    for (const k of allergenKeysIn(a)) by.set(k, "allergy");
  for (const d of p.diet ?? []) {
    const keys: AvoidKey[] = [...allergenKeysIn(d)];
    for (const [re, ks] of DIET_WORDS) if (re.test(d)) keys.push(...ks);
    for (const k of keys) if (!by.has(k)) by.set(k, "diet");
  }
  return [...by].map(([key, kind]) => ({ key, kind }));
}

// ─── What a dish contains ────────────────────────────────────────────────

/**
 * Words in a dish's name, description or ingredients that mean it likely
 * contains an allergen. Deliberately broad: a missed allergen is worse than
 * a chef unticking a suggestion.
 */
const DISH_WORDS: ReadonlyArray<[RegExp, AllergenKey[]]> = [
  [
    /\bmilk|dairy|cheese|cheddar|parmesan|parmigiano|mozzarella|ricotta|\bfeta\b|\bbrie\b|swiss|provolone|gouda|gruyere|mascarpone|queso|quesadilla|\bcream|butter(y|ed|milk)?\b|\byog(h)?urt|alfredo|custard|pudding|ice cream|gelato|sundae|milkshake|\bshake\b|latte|cappuccino|mocha|bisque|gratin|scalloped|bechamel|béchamel|ghee|whipped|tzatziki|ranch|stroganoff|carbonara|hollandaise|benedict|cheesecake|\bmac\b|pizza|lasagna|\bcocoa|hot chocolate|eggnog|popover|blondie|butterscotch|sherbet|twice baked|colcannon|casserole|elote|doughnut|donut/i,
    ["Milk"],
  ],
  [
    /\beggs?\b|omelet|frittata|quiche|mayo|mayonnaise|aioli|meringue|custard|hollandaise|benedict|carbonara|caesar|deviled|french toast|souffl|pancake|waffle|brioche|challah|tartar|remoulade|egg ?nog|crepe|crêpe|\bflan\b|cake|cookie|brownie|muffin|meatloaf|meatball|breaded|battered|brulee|brûlée|matzo|popover|blondie|doughnut|donut|macaroon|pappardelle/i,
    ["Egg"],
  ],
  [
    /\bfish\b|salmon|\btuna\b|\bcod\b|halibut|tilapia|trout|flounder|\bsole\b|haddock|anchov|sardine|catfish|snapper|mahi|\bbass\b|pollock|swordfish|grouper|walleye|\bcatch\b|caesar|worcestershire|krab|surimi|\blox\b|\bnicoise|niçoise|bloody mary/i,
    ["Fish"],
  ],
  [
    /shell ?fish|shrimp|prawn|\bcrabs?\b|krab|lobster|mussel|\bclams?\b|oyster|scallop|crawfish|crayfish|langoustine|calamari|squid|octopus|cioppino|bouillabaisse|paella|jambalaya|gumbo|seafood|scampi/i,
    ["Shellfish"],
  ],
  [
    /almond|pecan|walnut|cashew|pistachio|hazelnut|macadamia|pine ?nuts?|praline|pesto|marzipan|frangipane|nutella|baklava|\bnuts?\b|amaretto/i,
    ["Tree nuts"],
  ],
  [/peanut|\bpb ?& ?j\b|\bpbj\b|satay|pad thai|reese/i, ["Peanuts"]],
  [
    /wheat|gluten|flour|bread|\bbun\b|\bbuns\b|\brolls?\b|toast|sandwich|\bwrap\b|\bclub\b|reuben|\bmelt\b|panini|burger|\bsub\b|hoagie|biscuit|croissant|bagel|muffin|pancake|waffle|crepe|crêpe|pasta|spaghetti|noodle|linguine|fettuccine|penne|rigatoni|ravioli|tortellini|lasagna|macaroni|\bmac\b|gnocchi|orzo|couscous|barley|\brye\b|\bpie\b|pot pie|\btart|cake|cookie|brownie|cobbler|(apple|berry|peach|cherry|pear|fruit) crisp|crumble|pastry|pastries|danish|scone|cracker|crouton|panko|breaded|battered|\bbeer\b|tempura|dumpling|pizza|flatbread|pita|tortilla|burrito|quesadilla|enchilada|taco|cereal|granola|stuffing|stuffed shells|shells|gravy|roux|soy sauce|teriyaki|chicken fried|fried chicken|tenders|nuggets|fritter|\bcrust|pretzel|shortcake|strudel|bisque|chowder|stroganoff|\bale\b|lager|stout|porter\b|\bipa\b|matzo|popover|focaccia|blondie|churro|doughnut|donut|pappardelle|scaloppin|casserole/i,
    ["Wheat"],
  ],
  [
    /\bsoy|soya|tofu|edamame|teriyaki|miso|tempeh|hoisin|orange chicken|general tso|stir[- ]fry|lo mein|fried rice/i,
    ["Soy"],
  ],
  [/sesame|tahini|hummus|halva|everything bagel|bao\b/i, ["Sesame"]],
];

const NOT_WHEAT = /root beer|ginger beer|buckwheat/gi;
/** A dish that says it is free of something isn't suggested to contain it. */
const SAYS_NO_WHEAT = /gluten[- ]free|\bgf\b/i;
const SAYS_NO_DAIRY = /dairy[- ]free|non[- ]?dairy|lactose[- ]free|vegan/i;

/** A dish as far as allergens go: whichever of these fields it has. */
export interface DishText {
  name?: string | null;
  desc?: string | null;
  menuDescriptor?: string | null;
  ingredients?: ReadonlyArray<{ name?: string } | string> | null;
}

/** The allergens a dish likely contains, read from its name, description and ingredients. */
export function inferAllergens(d: DishText): AllergenKey[] {
  const text = [
    d.name,
    d.desc,
    d.menuDescriptor,
    ...(d.ingredients ?? []).map((i) =>
      typeof i === "string" ? i : (i?.name ?? ""),
    ),
  ]
    .filter(Boolean)
    .join(" · ");
  if (!text) return [];
  const out = new Set<AllergenKey>();
  const noWheat = SAYS_NO_WHEAT.test(text);
  const noDairy = SAYS_NO_DAIRY.test(text);
  for (const [re, keys] of DISH_WORDS) {
    for (const k of keys) {
      if ((k === "Wheat" && noWheat) || (k === "Milk" && noDairy)) continue;
      const t =
        k === "Milk"
          ? text.replace(NOT_DAIRY, " ")
          : k === "Wheat"
            ? text.replace(NOT_WHEAT, " ")
            : text;
      if (re.test(t)) out.add(k);
    }
  }
  return ALLERGEN_KEYS.filter((k) => out.has(k));
}

export interface DishAllergens {
  keys: AllergenKey[];
  /** True when nothing is recorded and these are read from the dish's words. */
  inferred: boolean;
}

/** A dish's allergens: the recorded tags when there are any, else a suggestion from its words. */
export function dishAllergens(
  d: DishText & { allergens?: readonly string[] | null },
): DishAllergens {
  const recorded = (d.allergens ?? [])
    .map(allergenKey)
    .filter((k): k is AllergenKey => !!k);
  if (recorded.length)
    return {
      keys: ALLERGEN_KEYS.filter((k) => recorded.includes(k)),
      inferred: false,
    };
  return { keys: inferAllergens(d), inferred: true };
}

const MEAT_PROTEINS =
  /^(beef|pork|chicken|turkey|lamb|veal|duck|meat|poultry)$/i;
const MEAT_WORDS =
  /\bbeef|\bpork|chicken|turkey|\blamb\b|\bveal\b|\bduck\b|bacon|\bham\b|sausage|steak|burger|meatball|meatloaf|bolognese|pepperoni|prosciutto|salami|brisket|\bribs?\b|pot roast|roast beef|pastrami|corned beef|chorizo|\bwings?\b|cheeseburger|reuben|\bclub\b|deli/i;
const NOT_MEAT = /veggie|vegetarian|vegan|plant[- ]based|impossible|beyond/i;

/** The dish has meat in it (for a vegetarian diet). */
export function dishHasMeat(
  d: DishText & { protein?: string | null },
): boolean {
  if (d.protein) return MEAT_PROTEINS.test(d.protein);
  const text = [d.name, d.desc].filter(Boolean).join(" ");
  return MEAT_WORDS.test(text) && !NOT_MEAT.test(text);
}

// ─── Where they meet ─────────────────────────────────────────────────────

export interface FoodConflict {
  key: AvoidKey;
  /** How to say it: the dish's own tag when it has one ("Gluten"), else the key's name. */
  label: string;
  kind: "allergy" | "diet";
  /** The dish's allergens were read from its words, not recorded. */
  inferred: boolean;
}

export type Dish = DishText & {
  allergens?: readonly string[] | null;
  protein?: string | null;
};

/** What in a dish the person must avoid, allergies first. */
export function foodConflicts(
  dish: Dish | null | undefined,
  person: AvoidSource | null | undefined,
): FoodConflict[] {
  if (!dish || !person) return [];
  const avoids = personAvoids(person);
  if (!avoids.length) return [];
  const { keys, inferred } = dishAllergens(dish);
  const tagFor = (k: AllergenKey) =>
    (dish.allergens ?? []).find((a) => allergenKey(a) === k);
  const out: FoodConflict[] = [];
  for (const a of avoids) {
    if (a.key === "Meat") {
      if (dishHasMeat(dish))
        out.push({ key: "Meat", label: "Meat", kind: a.kind, inferred: false });
    } else if (keys.includes(a.key)) {
      out.push({
        key: a.key,
        label: (!inferred && tagFor(a.key)) || KEY_LABEL[a.key],
        kind: a.kind,
        inferred,
      });
    }
  }
  return out.sort((x, y) =>
    x.kind === y.kind ? 0 : x.kind === "allergy" ? -1 : 1,
  );
}

/** Any allergy or diet conflict at all (the tile's warning flag). */
export function hasFoodConflict(
  dish: Dish | null | undefined,
  person: AvoidSource | null | undefined,
): boolean {
  return foodConflicts(dish, person).length > 0;
}

const list = (cs: FoodConflict[]) =>
  cs.map((c) => c.label.toLowerCase()).join(", ");

/**
 * One sentence for a server: "Rose is allergic to shellfish." or "Joan's diet
 * avoids dairy." A suggested allergen reads "may contain".
 */
export function conflictSentence(
  conflicts: FoodConflict[],
  firstName: string,
): string {
  const allergy = conflicts.filter((c) => c.kind === "allergy");
  const diet = conflicts.filter((c) => c.kind === "diet");
  const parts: string[] = [];
  const maybe = conflicts.some((c) => c.inferred)
    ? "May contain "
    : "Contains ";
  parts.push(maybe + list(conflicts) + ".");
  if (allergy.length)
    parts.push(`${firstName} is allergic to ${list(allergy)}.`);
  if (diet.length) parts.push(`${firstName}'s diet avoids ${list(diet)}.`);
  return parts.join(" ");
}
