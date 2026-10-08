import { describe, expect, it } from "vitest";
import { residents } from "../../../../data";
import {
  careLevel,
  seedBoResidents,
  withAllResidents,
  type BoResident,
} from "../../seed/residents";
import { kitchenNoteFor } from "../residentRecords";

describe("back office resident records", () => {
  it("cover every resident the dining tablets know, so each plan and kitchen note can be edited", () => {
    const list = seedBoResidents();
    expect(list.length).toBe(residents.length);
    for (const r of residents)
      expect(
        list.some((b) => b.id === r.id && b.name === r.name),
        r.name,
      ).toBe(true);
    const beatrice = list.find((b) => b.name === "Beatrice Sanderson")!;
    expect(beatrice).toMatchObject({
      planId: "pl1",
      kitchenNotes: "",
      allergies: ["Gluten"],
    });
  });

  it("keep the billing side of an existing record (plan, start day, notes)", () => {
    const joan = seedBoResidents().find((b) => b.id === "r6")!;
    expect(joan).toMatchObject({
      planId: "pl1",
      startDay: 8,
      kitchenNotes: "NO peanut products — severe",
    });
  });

  it("take the care level, diet and allergies from the dining record, so Billing and Residents agree", () => {
    for (const b of seedBoResidents()) {
      const d = residents.find((r) => r.id === b.id)!;
      expect(b.level, b.name).toBe(d.level);
      expect(careLevel(b.id)).toBe(d.level);
    }
    expect(careLevel("r6")).toBe("IL");
    expect(careLevel("r4")).toBe("AL");
  });

  it("bring an old saved copy (7 residents, stale levels) up to date without losing its edits", () => {
    const old: BoResident[] = seedBoResidents()
      .slice(0, 7)
      .map((r) =>
        r.id === "r4" ? { ...r, level: "IL", kitchenNotes: "Edited note" } : r,
      );
    const full = withAllResidents(old);
    expect(full.length).toBe(residents.length);
    expect(full.find((r) => r.id === "r4")).toMatchObject({
      level: "AL",
      kitchenNotes: "Edited note",
    });
    expect(withAllResidents(full)).toBe(full);
  });

  it("give the kitchen note for a resident, trimmed, and nothing for anyone else", () => {
    const list = seedBoResidents();
    expect(kitchenNoteFor(list, "r1")).toBe("Cut sandwich in quarters");
    expect(kitchenNoteFor(list, "r9")).toBe("");
    expect(kitchenNoteFor(list, null)).toBe("");
  });
});
