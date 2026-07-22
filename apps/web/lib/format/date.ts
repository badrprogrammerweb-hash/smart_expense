export type DisplayDateValue = Date | number | string;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Date-only strings (e.g. the backend's `occurred_on`, "2026-07-13") carry no
 * time or timezone — they name a calendar day, not a moment. Parsing them
 * through `Date` and reading UTC/local getters back out is timezone-dependent
 * and can shift the day by one. Read the Y/M/D components directly instead.
 */
function formatDateOnlyString(value: string): string {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new RangeError("A valid date is required for display formatting.");
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * `Date` objects and numeric timestamps represent a specific moment (e.g. a
 * date picker's local-midnight selection, or an epoch `created_at`). Reading
 * them back with the runtime's LOCAL getters reproduces the calendar day the
 * value was constructed from/observed in — UTC getters would shift a
 * locally-constructed midnight (e.g. `new Date(2026, 6, 13)`) back a day for
 * any positive-offset timezone such as Asia/Riyadh (UTC+3).
 */
function formatDateInstant(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("A valid date is required for display formatting.");
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).padStart(4, "0");

  return `${day}/${month}/${year}`;
}

/** Formats every user-facing date with the product's locale-independent date contract. */
export function formatDisplayDate(value: DisplayDateValue): string {
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value)) {
    return formatDateOnlyString(value);
  }

  return formatDateInstant(value);
}
