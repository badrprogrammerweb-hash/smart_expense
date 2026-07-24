import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  EMPTY_HISTORY_FILTERS,
  RecordHistoryFilters,
  filterHistoryRecords,
  type HistoryFilterState,
} from "@/components/records/RecordHistoryFilters";
import messages from "@/messages/en.json";

const records = [
  { id: "salary", occurred_on: "2026-07-01", description: "Monthly salary", merchant_name: null },
  { id: "lunch", occurred_on: "2026-07-12", description: "Team lunch", merchant_name: "Cafe" },
  { id: "fuel", occurred_on: "2026-07-20", description: null, merchant_name: "Fuel station" },
];

describe("financial history filtering", () => {
  it("combines inclusive date bounds with case-insensitive text matching", () => {
    const result = filterHistoryRecords(
      records,
      { query: "CAFE", start: "2026-07-10", end: "2026-07-15" },
      (record) => [record.description, record.merchant_name],
    );

    expect(result.map((record) => record.id)).toEqual(["lunch"]);
  });

  it("renders phone-friendly controls and clears every active filter", () => {
    function Harness() {
      const [filters, setFilters] = useState<HistoryFilterState>({
        query: "lunch",
        start: "2026-07-01",
        end: "2026-07-31",
      });
      return <RecordHistoryFilters value={filters} onChange={setFilters} />;
    }

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Harness />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("searchbox", { name: "Search history" })).toHaveValue("lunch");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("searchbox", { name: "Search history" })).toHaveValue(
      EMPTY_HISTORY_FILTERS.query,
    );
    expect(screen.getByLabelText("From date")).toHaveValue(EMPTY_HISTORY_FILTERS.start);
    expect(screen.getByLabelText("To date")).toHaveValue(EMPTY_HISTORY_FILTERS.end);
  });
});
