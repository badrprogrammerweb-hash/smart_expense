import { describe, expect, it } from "vitest";

import { minorUnitDigits, supportedCurrencies, type SupportedCurrency } from "@/lib/currency";
import { parseInputToMinor, toDisplayAmount } from "@/lib/money";

function expectedDisplay(minor: number, locale: string, currency: SupportedCurrency) {
  const digits = minorUnitDigits[currency];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 10 ** digits);
}

describe("currency-aware money formatting", () => {
  it("formats every supported currency in English and Arabic", () => {
    for (const currency of supportedCurrencies) {
      for (const locale of ["en", "ar"]) {
        expect(toDisplayAmount(123456, locale, currency)).toBe(
          expectedDisplay(123456, locale, currency),
        );
      }
    }
  });

  it("parses all supported currencies using their configured minor-unit digits", () => {
    for (const currency of supportedCurrencies) {
      const digits = minorUnitDigits[currency];
      const input = digits === 3 ? "12.345" : "12.34";
      const expected = digits === 3 ? 12345 : 1234;

      expect(parseInputToMinor(input, currency)).toBe(expected);
      expect(toDisplayAmount(expected, "en", currency)).toBe(
        expectedDisplay(expected, "en", currency),
      );
    }
  });

  it("rejects fractional precision that exceeds the currency's minor-unit digits", () => {
    expect(parseInputToMinor("1.234", "USD")).toBeNaN();
    expect(parseInputToMinor("1.234", "SAR")).toBeNaN();
    expect(parseInputToMinor("1.234", "KWD")).toBe(1234);
    expect(parseInputToMinor("1.2345", "KWD")).toBeNaN();
  });
});
