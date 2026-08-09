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

function normalizeAmountInput(input: string) {
  return input.trim().replace(/,/g, "");
}

/**
 * Why an amount input was rejected. `parseInputToMinor` collapses every
 * failure into `NaN`, which is all the storage path needs but leaves the UI
 * unable to name the rule that was actually broken.
 */
export type AmountValidationReason =
  | "required"
  | "invalid"
  | "not_positive"
  | "too_many_decimals"
  | "too_large";

/** Accepts anything shaped like a decimal number, including the negatives and
 * over-precise values `parseInputToMinor` rejects, so those can be told apart
 * from genuine non-numbers such as "abc". */
const LOOSE_DECIMAL_PATTERN = /^-?\d+(\.\d*)?$/;

/**
 * Classifies an amount input against the workspace currency's precision.
 * Returns `null` when the value is acceptable — i.e. exactly when
 * `parseInputToMinor` yields a positive minor amount.
 *
 * Order matters: a negative with too many decimals ("-100.9999" in SAR) is
 * reported as not-positive, because the sign is the error the user must fix
 * first and precision advice would be misleading while the value is negative.
 */
export function classifyAmountInput(
  input: string,
  currency: SupportedCurrency,
): AmountValidationReason | null {
  const normalized = normalizeAmountInput(input);

  if (!normalized) {
    return "required";
  }

  if (!LOOSE_DECIMAL_PATTERN.test(normalized)) {
    return "invalid";
  }

  if (normalized.startsWith("-") || Number(normalized) === 0) {
    return "not_positive";
  }

  const [, fractionPart = ""] = normalized.split(".");

  if (fractionPart.length > minorUnitDigits[currency]) {
    return "too_many_decimals";
  }

  // Everything else this currency's precision allows; only an amount beyond
  // the safe-integer minor range can still fail.
  return Number.isNaN(parseInputToMinor(normalized, currency)) ? "too_large" : null;
}

export function parseInputToMinor(input: string, currency: SupportedCurrency) {
  const fractionDigits = minorUnitDigits[currency];
  const normalized = normalizeAmountInput(input);
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
