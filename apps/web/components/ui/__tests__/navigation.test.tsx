import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Sidebar } from "@/components/ui/sidebar";
import { Tabs } from "@/components/ui/tabs";

describe("navigation primitives", () => {
  it("exposes the current page in the direction-aware sidebar", () => { render(<Sidebar items={[{ href: "/dashboard", label: "Dashboard", active: true }]} />); expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page"); });
  it("marks the selected tab", () => { render(<Tabs value="income" onChange={() => {}} tabs={[{ value: "income", label: "Income" }]} />); expect(screen.getByRole("tab", { name: "Income" })).toHaveAttribute("aria-selected", "true"); });
});
