import { describe, expect, it } from "vitest";

import { parseInputToMinor, toDisplayAmount } from "@/lib/money";

// Intl.NumberFormat's currency style joins the code and amount with a
// non-breaking space (U+00A0), not a regular space.
const NBSP = " ";

describe("money", () => {
  it("round-trips whole SAR amounts with no drift", () => {
    expect(parseInputToMinor("5000")).toBe(500000);
    expect(toDisplayAmount(parseInputToMinor("5000"), "en")).toBe(`SAR${NBSP}5,000.00`);
  });

  it("round-trips fractional SAR amounts with no floating-point drift", () => {
    expect(parseInputToMinor("450.50")).toBe(45050);
    expect(toDisplayAmount(parseInputToMinor("450.50"), "en")).toBe(`SAR${NBSP}450.50`);

    // A classic float trap: 0.1 + 0.2 !== 0.3 in binary floating point.
    // parseInputToMinor works in integer minor units via BigInt, so
    // amounts like this must still round-trip exactly.
    expect(parseInputToMinor("0.10")).toBe(10);
    expect(parseInputToMinor("0.20")).toBe(20);
    expect(parseInputToMinor("0.30")).toBe(30);
  });

  it("treats a single fractional digit as exact, not lossy, by zero-padding it", () => {
    // "10.5" means the same amount as "10.50" — this pads to that rather
    // than rounding, so there is no precision loss to round.
    expect(parseInputToMinor("10.5")).toBe(1050);
  });

  it("rejects malformed input rather than silently truncating", () => {
    expect(parseInputToMinor("abc")).toBeNaN();
    expect(parseInputToMinor("10.999")).toBeNaN();
    expect(parseInputToMinor("-5")).toBeNaN();
  });

  it("formats negative minor amounts as a clearly negative SAR value", () => {
    expect(toDisplayAmount(-40000, "en")).toBe(`-SAR${NBSP}400.00`);
  });
});
