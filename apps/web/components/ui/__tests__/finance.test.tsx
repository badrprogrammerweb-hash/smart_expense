import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chart } from "@/components/ui/chart";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryCard } from "@/components/ui/summary-card";

describe("finance primitives", () => {
  it("makes remaining balance dominant and preserves tabular values", () => { render(<SummaryCard label="Remaining balance" value="SAR 1,250.00" />); expect(screen.getByText("SAR 1,250.00")).toHaveClass("text-3xl"); });
  it("uses an icon and label for status", () => { render(<StatusBadge status="pending" />); expect(screen.getByText("Pending review")).toBeVisible(); });
  it("requires a textual chart summary", () => { render(<Chart title="Spending trend" summary="Expenses increased by SAR 25." ><div>Chart graphic</div></Chart>); expect(screen.getByText("Expenses increased by SAR 25.")).toBeVisible(); });
});
