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

/**
 * Today's calendar day as the `YYYY-MM-DD` the backend stores, read from the
 * runtime's LOCAL clock.
 *
 * `new Date().toISOString().slice(0, 10)` truncates the UTC instant instead,
 * which names a different day whenever the local and UTC dates disagree. In
 * Asia/Riyadh (UTC+3) that is every local 00:00–02:59, when UTC is still on the
 * previous day — so a form defaulting to "today" would pre-fill yesterday and
 * file the record under the wrong date unless the user noticed.
 *
 * Reads the same local getters as `formatDateInstant` above, so a default date
 * and the `formatDisplayDate` rendering of it always name the same day.
 */
export function todayIsoDate(now: Date = new Date()): string {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError("A valid date is required for display formatting.");
  }

  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
