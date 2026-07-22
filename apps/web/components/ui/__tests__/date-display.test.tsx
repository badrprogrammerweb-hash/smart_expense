import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DateDisplay, Ltr } from "@/components/ui/date-display";
import { formatDisplayDate } from "@/lib/format/date";

describe("date display", () => {
  it("formats dates as zero-padded DD/MM/YYYY with Western digits", () => {
    expect(formatDisplayDate("2026-07-13T00:00:00.000Z")).toBe("13/07/2026");
    expect(formatDisplayDate(new Date("2026-01-02T00:00:00.000Z"))).toBe("02/01/2026");
  });

  it("formats date-only strings (e.g. occurred_on) by their literal calendar day, independent of timezone", () => {
    expect(formatDisplayDate("2026-07-13")).toBe("13/07/2026");
  });

  it("formats a locally-constructed Date (e.g. a date-picker selection) as the day it was set to, not shifted by UTC conversion", () => {
    // Regression guard: a naive `getUTCDate()`-based formatter shifts a local
    // midnight `Date` back one day in any positive-offset timezone (e.g.
    // Asia/Riyadh, UTC+3) because local midnight July 13 is 21:00 UTC July 12.
    expect(formatDisplayDate(new Date(2026, 6, 13))).toBe("13/07/2026");
  });

  it("isolates displayed dates as left-to-right content", () => {
    render(<DateDisplay date="2026-07-13T00:00:00.000Z" />);

    expect(screen.getByText("13/07/2026")).toHaveAttribute("dir", "ltr");
  });

  it("offers the same isolation wrapper for technical content", () => {
    render(<Ltr>provider_123@example.com</Ltr>);

    expect(screen.getByText("provider_123@example.com")).toHaveAttribute("dir", "ltr");
  });
});
