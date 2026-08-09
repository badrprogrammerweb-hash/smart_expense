import { describe, expect, it } from "vitest";

import { classifyAmountInput, parseInputToMinor, toDisplayAmount } from "@/lib/money";

// Intl.NumberFormat's currency style joins the code and amount with a
// non-breaking space (U+00A0), not a regular space.
const NBSP = "\u00a0";

describe("money", () => {
  it("round-trips whole SAR amounts with no drift", () => {
    expect(parseInputToMinor("5000", "SAR")).toBe(500000);
    expect(toDisplayAmount(parseInputToMinor("5000", "SAR"), "en", "SAR")).toBe(`SAR${NBSP}5,000.00`);
  });

  it("round-trips fractional SAR amounts with no floating-point drift", () => {
    expect(parseInputToMinor("450.50", "SAR")).toBe(45050);
    expect(toDisplayAmount(parseInputToMinor("450.50", "SAR"), "en", "SAR")).toBe(`SAR${NBSP}450.50`);

    // A classic float trap: 0.1 + 0.2 !== 0.3 in binary floating point.
    // parseInputToMinor works in integer minor units via BigInt, so
    // amounts like this must still round-trip exactly.
    expect(parseInputToMinor("0.10", "SAR")).toBe(10);
    expect(parseInputToMinor("0.20", "SAR")).toBe(20);
    expect(parseInputToMinor("0.30", "SAR")).toBe(30);
  });

  it("treats a single fractional digit as exact, not lossy, by zero-padding it", () => {
    // "10.5" means the same amount as "10.50" - this pads to that rather
    // than rounding, so there is no precision loss to round.
    expect(parseInputToMinor("10.5", "SAR")).toBe(1050);
  });

  it("rejects malformed input rather than silently truncating", () => {
    expect(parseInputToMinor("abc", "SAR")).toBeNaN();
    expect(parseInputToMinor("10.999", "SAR")).toBeNaN();
    expect(parseInputToMinor("-5", "SAR")).toBeNaN();
  });

  it("formats negative minor amounts as a clearly negative SAR value", () => {
    expect(toDisplayAmount(-40000, "en", "SAR")).toBe(`-SAR${NBSP}400.00`);
  });
});

describe("classifyAmountInput", () => {
  it("accepts values within the currency's own precision", () => {
    expect(classifyAmountInput("100.99", "SAR")).toBeNull();
    expect(classifyAmountInput("100.9", "SAR")).toBeNull();
    expect(classifyAmountInput("100", "SAR")).toBeNull();
    // KWD is a 3-decimal currency, so the value SAR rejects is valid here.
    expect(classifyAmountInput("100.993", "KWD")).toBeNull();
    expect(classifyAmountInput("100.99", "KWD")).toBeNull();
  });

  it("names precision as the reason, per currency, instead of a positivity rule", () => {
    expect(classifyAmountInput("100.993", "SAR")).toBe("too_many_decimals");
    expect(classifyAmountInput("100.9934", "KWD")).toBe("too_many_decimals");
    // Every 3-decimal currency behaves the same; nothing is SAR/KWD-specific.
    expect(classifyAmountInput("1.0001", "BHD")).toBe("too_many_decimals");
    expect(classifyAmountInput("1.001", "OMR")).toBeNull();
  });

  it("separates the six failures the audit found collapsed into one message", () => {
    expect(classifyAmountInput("", "SAR")).toBe("required");
    expect(classifyAmountInput("   ", "SAR")).toBe("required");
    expect(classifyAmountInput("0", "SAR")).toBe("not_positive");
    expect(classifyAmountInput("0.00", "SAR")).toBe("not_positive");
    expect(classifyAmountInput("-50", "SAR")).toBe("not_positive");
    expect(classifyAmountInput("abc", "SAR")).toBe("invalid");
    expect(classifyAmountInput("1.2.3", "SAR")).toBe("invalid");
    expect(classifyAmountInput("999999999999999999999", "SAR")).toBe("too_large");
  });

  it("reports the sign first when a value is both negative and over-precise", () => {
    // Precision advice would be misleading while the value is still negative.
    expect(classifyAmountInput("-100.9999", "SAR")).toBe("not_positive");
  });

  it("agrees exactly with what parseInputToMinor will accept", () => {
    const cases: Array<[string, "SAR" | "KWD"]> = [
      ["", "SAR"],
      ["0", "SAR"],
      ["-50", "SAR"],
      ["abc", "SAR"],
      ["100.993", "SAR"],
      ["100.99", "SAR"],
      ["100.993", "KWD"],
      ["100.9934", "KWD"],
      ["999999999999999999999", "SAR"],
      ["1,000.50", "SAR"],
    ];

    // The classifier must never call an amount acceptable that the storage
    // path then rejects (or vice versa) — that would silently drop a record.
    cases.forEach(([input, currency]) => {
      const minor = parseInputToMinor(input, currency);
      const accepted = !Number.isNaN(minor) && minor > 0;

      expect(classifyAmountInput(input, currency) === null).toBe(accepted);
    });
  });
});
