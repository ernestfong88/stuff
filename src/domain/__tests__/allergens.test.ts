import { describe, expect, it } from "vitest";
import { getItem, residents } from "../../data";
import { boResidents } from "../../surfaces/backoffice/seed/residents";
import { SHIPPED_RECIPES as recipes } from "../../store/shippedRecipes";
import {
  allergenKey,
  allergenKeysIn,
  conflictSentence,
  dishAllergens,
  foodConflicts,
  hasFoodConflict,
  inferAllergens,
  personAvoids,
} from "../allergens";
import { allergenConflicts } from "../orders";
import { dinerPills } from "../residents";

const keys = (p: Parameters<typeof personAvoids>[0]) =>
  personAvoids(p).map((a) => a.key);
const resident = (id: string) => residents.find((r) => r.id === id)!;

describe("a person’s allergies and diets, by meaning", () => {
  it("reads the care app’s free text", () => {
    expect(allergenKeysIn("MUSSELS, OR CLAMS")).toEqual(["Shellfish"]);
    expect(allergenKeysIn("Gluten allergy")).toEqual(["Wheat"]);
    expect(allergenKeysIn("No Dairy, Avoid Soy (Sensitivity)")).toEqual([
      "Milk",
      "Soy",
    ]);
    expect(allergenKeysIn("severe peanut")).toEqual(["Peanuts"]);
    expect(allergenKeysIn("Lactose intolerant")).toEqual(["Milk"]);
    expect(allergenKeysIn("Celiac")).toEqual(["Wheat"]);
    expect(allergenKeysIn("sesame / tahini")).toEqual(["Sesame"]);
    expect(allergenKeysIn("eggs")).toEqual(["Egg"]);
    expect(allergenKeysIn("salmon and other fish")).toEqual(["Fish"]);
  });

  it("keeps tree nuts and peanuts apart unless the note just says nuts", () => {
    expect(allergenKeysIn("Tree nut allergy")).toEqual(["Tree nuts"]);
    expect(allergenKeysIn("almonds, walnuts")).toEqual(["Tree nuts"]);
    expect(allergenKeysIn("Peanuts")).toEqual(["Peanuts"]);
    expect(allergenKeysIn("peanut butter")).toEqual(["Peanuts"]);
    expect(allergenKeysIn("Nut allergy")).toEqual(["Tree nuts", "Peanuts"]);
  });

  it("does not invent allergens from unrelated words", () => {
    expect(
      allergenKeysIn(
        "No fruits with seeds — strawberries, kiwi, berries (abdominal pain)",
      ),
    ).toEqual([]);
    expect(allergenKeysIn("Low Sodium")).toEqual([]);
    expect(allergenKeysIn("Butternut squash is fine")).toEqual([]);
  });

  it("counts diets: gluten-free and no dairy avoid those foods, a vegetarian avoids meat and fish", () => {
    expect(personAvoids({ diet: ["Gluten-Friendly"] })).toEqual([
      { key: "Wheat", kind: "diet" },
    ]);
    expect(keys({ diet: ["Vegetarian"] })).toEqual([
      "Meat",
      "Fish",
      "Shellfish",
    ]);
    expect(keys({ diet: ["Vegan"] })).toEqual([
      "Meat",
      "Fish",
      "Shellfish",
      "Milk",
      "Egg",
    ]);
    expect(keys({ diet: ["Diabetic", "Pureed", "No Salt Added"] })).toEqual([]);
  });

  it("an allergy outranks a diet for the same food", () => {
    expect(
      personAvoids({ allergies: ["Gluten"], diet: ["Gluten-free"] }),
    ).toEqual([{ key: "Wheat", kind: "allergy" }]);
  });

  it("every seed resident with an allergy has it understood", () => {
    expect(keys(resident("r4"))).toEqual(["Shellfish"]);
    expect(keys(resident("r8"))).toEqual(["Wheat"]);
    expect(keys(resident("r10"))).toEqual(["Wheat"]);
    expect(keys(resident("r6"))).toEqual(["Peanuts", "Milk", "Soy"]);
  });
});

describe("what a dish contains", () => {
  it("reads both tag vocabularies", () => {
    expect(
      [
        "Dairy",
        "Milk",
        "Gluten",
        "Wheat",
        "Tree Nuts",
        "Tree nuts",
        "Peanuts",
      ].map(allergenKey),
    ).toEqual([
      "Milk",
      "Milk",
      "Wheat",
      "Wheat",
      "Tree nuts",
      "Tree nuts",
      "Peanuts",
    ]);
    expect(allergenKey("Spicy")).toBeNull();
  });

  it("suggests allergens from the name, description and ingredients", () => {
    expect(inferAllergens({ name: "Shrimp and Grits" })).toContain("Shellfish");
    expect(inferAllergens({ name: "Dungeness Crab Louie" })).toContain(
      "Shellfish",
    );
    expect(inferAllergens({ name: "Lobster Ravioli" })).toEqual(
      expect.arrayContaining(["Shellfish", "Wheat"]),
    );
    expect(
      inferAllergens({
        name: "Fish and Chips",
        desc: "Beer-battered cod with fries",
      }),
    ).toEqual(expect.arrayContaining(["Fish", "Wheat"]));
    expect(inferAllergens({ name: "Pecan Pie" })).toEqual(
      expect.arrayContaining(["Tree nuts", "Wheat"]),
    );
    expect(
      inferAllergens({ name: "Satay", desc: "with peanut sauce" }),
    ).toContain("Peanuts");
    expect(
      inferAllergens({ name: "Tofu stir fry", desc: "sesame glaze" }),
    ).toEqual(expect.arrayContaining(["Soy", "Sesame"]));
    expect(
      inferAllergens({
        name: "Soup",
        ingredients: [
          { name: "butter" },
          { name: "flour" },
          { name: "egg yolk" },
        ],
      }),
    ).toEqual(["Milk", "Egg", "Wheat"]);
  });

  it("is not fooled by look-alike words", () => {
    expect(inferAllergens({ name: "Almond Milk" })).toEqual(["Tree nuts"]);
    expect(inferAllergens({ name: "Root Beer" })).toEqual([]);
    expect(inferAllergens({ name: "Roasted Butternut Squash Soup" })).toEqual(
      [],
    );
    expect(inferAllergens({ name: "Eggplant Stack" })).not.toContain("Egg");
    expect(inferAllergens({ name: "Gluten-free brownie" })).not.toContain(
      "Wheat",
    );
  });

  it("flags every shellfish and fish recipe in the Recipe Book that has no allergens recorded", () => {
    const list = recipes as Array<{
      name: string;
      desc?: string;
      allergens?: string[];
    }>;
    const shellfish = list.filter(
      (r) =>
        !r.allergens?.length &&
        /shrimp|crab|lobster|scallop|clam|mussel|oyster/i.test(r.name),
    );
    expect(shellfish.length).toBeGreaterThan(10);
    for (const r of shellfish)
      expect(inferAllergens(r), r.name).toContain("Shellfish");
    const fish = list.filter(
      (r) =>
        !r.allergens?.length &&
        /salmon|cod\b|halibut|tilapia|flounder|\bsole\b|tuna|trout/i.test(
          r.name,
        ),
    );
    for (const r of fish) expect(inferAllergens(r), r.name).toContain("Fish");
  });

  it("recorded allergens win; a suggestion is marked inferred", () => {
    expect(
      dishAllergens({ name: "Shrimp Cocktail", allergens: ["Fish"] }),
    ).toEqual({ keys: ["Fish"], inferred: false });
    expect(dishAllergens({ name: "Shrimp Cocktail", allergens: [] })).toEqual({
      keys: ["Shellfish"],
      inferred: true,
    });
  });
});

describe("allergy warnings", () => {
  it('Rose’s "MUSSELS, OR CLAMS" flags the Krab Cakes', () => {
    const c = allergenConflicts({ itemId: "l_krab" }, resident("r4"));
    expect(c).toEqual([
      {
        key: "Shellfish",
        label: "Shellfish",
        kind: "allergy",
        inferred: false,
      },
    ]);
    expect(conflictSentence(c, "Rose")).toBe(
      "Contains shellfish. Rose is allergic to shellfish.",
    );
  });

  it('Mildred’s "Gluten allergy" flags bread; Beatrice’s "Gluten" still does', () => {
    expect(
      allergenConflicts({ itemId: "l_flounder" }, resident("r8")).map(
        (c) => c.label,
      ),
    ).toEqual(["Gluten"]);
    expect(
      allergenConflicts({ itemId: "l_flounder" }, resident("r10")).map(
        (c) => c.label,
      ),
    ).toEqual(["Gluten"]);
  });

  it("Joan: the PB & J is an allergy, the ice cream is against her diet", () => {
    const pbj = allergenConflicts({ itemId: "l_pbj" }, resident("r6"));
    expect(pbj.map((c) => [c.key, c.kind])).toEqual([["Peanuts", "allergy"]]);
    const ice = allergenConflicts({ itemId: "l_icecream" }, resident("r6"));
    expect(ice.map((c) => [c.label, c.kind])).toEqual([["Dairy", "diet"]]);
    expect(conflictSentence(ice, "Joan")).toBe(
      "Contains dairy. Joan's diet avoids dairy.",
    );
  });

  it('a dish with nothing recorded warns from its words, as "may contain"', () => {
    const item = getItem("cv_ao_shrimp")!;
    expect(item.allergens).toEqual([]);
    const c = foodConflicts(item, resident("r4"));
    expect(c).toEqual([
      { key: "Shellfish", label: "Shellfish", kind: "allergy", inferred: true },
    ]);
    expect(conflictSentence(c, "Rose")).toMatch(/^May contain shellfish\./);
  });

  it("a vegetarian is warned about meat", () => {
    expect(
      hasFoodConflict(
        { name: "Beef Stroganoff", protein: "beef" },
        { diet: ["Vegetarian"] },
      ),
    ).toBe(true);
    expect(
      hasFoodConflict(
        { name: "Garden Salad", protein: "veg" },
        { diet: ["Vegetarian"] },
      ),
    ).toBe(false);
    expect(
      hasFoodConflict({ name: "Veggie Burger" }, { diet: ["Vegetarian"] }),
    ).toBe(false);
  });

  it("nothing on file, nothing flagged", () => {
    expect(foodConflicts(getItem("l_krab"), resident("r1"))).toEqual([]);
    expect(foodConflicts(getItem("l_krab"), null)).toEqual([]);
  });
});

describe("seed residents: allergies in notes are on file", () => {
  it("Joan’s severe peanut allergy is on her allergy list", () => {
    expect(resident("r6").allergies.join(" ")).toMatch(/peanut/i);
  });

  it("no kitchen note mentions an allergen the resident’s lists leave out", () => {
    for (const b of boResidents as Array<{
      id: string;
      name: string;
      kitchenNotes?: string;
    }>) {
      const r = residents.find((x) => x.id === b.id && x.name === b.name);
      if (!r) continue;
      const onFile = new Set(keys(r));
      const said = allergenKeysIn(b.kitchenNotes ?? "");
      expect(
        said.filter((k) => !onFile.has(k)),
        b.name,
      ).toEqual([]);
    }
  });
});

describe("ticket tags", () => {
  const diner = (refId: string) => ({
    id: "x",
    kind: "resident" as const,
    refId,
    isGuest: false,
    seat: 1,
    items: [],
  });

  it("an independent living resident’s allergy reaches the ticket, but not their diet tags", () => {
    expect(resident("r6").level).toBe("IL");
    expect(dinerPills(diner("r6"))).toEqual([
      { kind: "allergy", text: "Peanut" },
    ]);
  });
});
