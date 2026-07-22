import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobileRecordCard } from "@/components/ui/mobile-record-card";
import { Table } from "@/components/ui/table";

const record = { id: "record-1", type: "Expense", amount: "SAR 10.00", category: "Food / Lunch", merchant: "Cafe", date: "13/07/2026", status: "Confirmed", actor: "Owner" };
describe("data primitives", () => {
  it("renders the record fields consistently in table and mobile card shapes", () => {
    render(<><Table caption="Records" data={[record]} columns={Object.entries(record).filter(([key]) => key !== "id").map(([key]) => ({ key, header: key, cell: (item: typeof record) => item[key as keyof typeof record] }))} /><MobileRecordCard title={record.type} fields={Object.entries(record).filter(([key]) => key !== "id" && key !== "type").map(([label, value]) => ({ label, value }))} /></>);
    expect(screen.getByRole("table", { name: "Records" })).toHaveTextContent("Food / Lunch");
    expect(screen.getByText("Confirmed", { selector: "dd" })).toBeVisible();
  });
});
