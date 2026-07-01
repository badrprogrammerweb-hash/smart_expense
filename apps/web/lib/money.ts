const SAR_FRACTION_DIGITS = 2;
const MINOR_UNITS_PER_SAR = 100;

export function toDisplayAmount(minor: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: SAR_FRACTION_DIGITS,
    maximumFractionDigits: SAR_FRACTION_DIGITS,
  }).format(minor / MINOR_UNITS_PER_SAR);
}

export function parseInputToMinor(input: string) {
  const normalized = input.trim().replace(/,/g, "");

  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
    return Number.NaN;
  }

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const wholeMinor = BigInt(wholePart || "0") * BigInt(MINOR_UNITS_PER_SAR);
  const fractionMinor = BigInt(fractionPart.padEnd(SAR_FRACTION_DIGITS, "0").slice(0, 2));
  const totalMinor = wholeMinor + fractionMinor;

  if (totalMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.NaN;
  }

  return Number(totalMinor);
}
