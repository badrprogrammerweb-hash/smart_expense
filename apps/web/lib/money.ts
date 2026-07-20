import { minorUnitDigits, type SupportedCurrency } from "@/lib/currency";

function minorUnitsPerMajor(currency: SupportedCurrency) {
  return 10 ** minorUnitDigits[currency];
}

export function toDisplayAmount(minor: number, locale: string, currency: SupportedCurrency) {
  const fractionDigits = minorUnitDigits[currency];

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(minor / minorUnitsPerMajor(currency));
}

export function parseInputToMinor(input: string, currency: SupportedCurrency) {
  const fractionDigits = minorUnitDigits[currency];
  const normalized = input.trim().replace(/,/g, "");
  const pattern = new RegExp(`^\\d+(\\.\\d{0,${fractionDigits}})?$`);

  if (!pattern.test(normalized)) {
    return Number.NaN;
  }

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const wholeMinor = BigInt(wholePart || "0") * BigInt(minorUnitsPerMajor(currency));
  const fractionMinor = BigInt(fractionPart.padEnd(fractionDigits, "0"));
  const totalMinor = wholeMinor + fractionMinor;

  if (totalMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.NaN;
  }

  return Number(totalMinor);
}
