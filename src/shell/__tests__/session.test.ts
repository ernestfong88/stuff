import { describe, expect, it } from "vitest";
import { setPin } from "../../store/pins";
import { ADP_ASSOCIATES } from "../../surfaces/backoffice/seed/associates";
import { checkPin, PIN_ROSTER } from "../session";

describe("PIN sign-in", () => {
  it("accepts every associate on Associates & PINs who signs in with a PIN", () => {
    const withPin = ADP_ASSOCIATES.filter((a) => !a.win && a.pin);
    expect(withPin.length).toBeGreaterThan(3);
    for (const a of withPin) expect(checkPin(a.pin!)?.id, a.name).toBe(a.id);
    expect(checkPin("5820")).toMatchObject({
      id: "MG",
      name: "Marisol Garcia",
      initials: "MG",
      role: "Dining Server",
    });
  });

  it("never lets a Windows-login associate in by PIN", () => {
    for (const a of ADP_ASSOCIATES.filter((x) => x.win))
      expect(
        PIN_ROSTER.some((s) => s.id === a.id),
        a.name,
      ).toBe(false);
  });

  it("a reset PIN replaces the old one", () => {
    setPin("MG", "4826");
    expect(checkPin("4826")?.id).toBe("MG");
    expect(checkPin("5820")).toBeNull();
  });
});
