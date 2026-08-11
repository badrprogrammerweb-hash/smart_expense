import { cleanup, render, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpenseForm } from "@/components/expense/ExpenseForm";
import { IncomeForm } from "@/components/income/IncomeForm";
import type { IncomeRecord } from "@/lib/api/incomes";
import { FormFooter } from "@/components/ui";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

vi.mock("@/hooks/use-incomes", () => ({
  useCreateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-expenses", () => ({
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: () => ({ data: { categories: [] }, isLoading: false }),
}));

function renderWith(ui: ReactNode, locale: "en" | "ar" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const savedIncome = {
  id: "income-1",
  amount_minor: 12345,
  currency: "SAR",
  occurred_on: "2026-08-07",
  description: "Consulting",
  category_id: null,
  status: "confirmed",
  created_at: "2026-08-07T09:00:00Z",
} as IncomeRecord;

function duplicateIds(container: HTMLElement) {
  const counts = new Map<string, number>();
  container.querySelectorAll("[id]").forEach((el) => {
    counts.set(el.id, (counts.get(el.id) ?? 0) + 1);
  });
  return [...counts.entries()].filter(([, n]) => n > 1);
}

afterEach(() => {
  cleanup();
});

// BUG-09: the record list renders each record twice — a desktop `<ul>` and a
// mobile `<div>` — so opening one editor mounted two more form instances on top
// of the always-present create form. Three elements then shared each literal
// id, and `label[for]` resolves to the first match in the document, so clicking
// a label inside an editor focused the create form at the top of the page.
describe("form field ids are unique per form instance", () => {
  it("keeps every id unique across create + desktop edit + mobile edit income forms", () => {
    const { container } = renderWith(
      <div>
        <IncomeForm workspaceId="w1" role="owner" currency="SAR" />
        <IncomeForm workspaceId="w1" role="owner" currency="SAR" record={savedIncome} />
        <IncomeForm workspaceId="w1" role="owner" currency="SAR" record={savedIncome} />
      </div>,
    );

    expect(duplicateIds(container)).toEqual([]);
  });

  it("keeps every id unique across create + two edit expense forms", () => {
    const { container } = renderWith(
      <div>
        <ExpenseForm workspaceId="w1" role="member" currency="SAR" />
        <ExpenseForm workspaceId="w1" role="member" currency="SAR" />
        <ExpenseForm workspaceId="w1" role="member" currency="SAR" />
      </div>,
    );

    expect(duplicateIds(container)).toEqual([]);
  });

  it("points each label at the field inside its own form, not the first on the page", () => {
    renderWith(
      <div>
        <IncomeForm workspaceId="w1" role="owner" currency="SAR" />
        <IncomeForm workspaceId="w1" role="owner" currency="SAR" record={savedIncome} />
      </div>,
    );

    // A <form> with no accessible name exposes no `form` role, so select the
    // elements directly rather than by role.
    const forms = Array.from(document.querySelectorAll("form")) as HTMLElement[];
    expect(forms).toHaveLength(2);

    for (const form of forms) {
      const scope = within(form);
      // `getByLabelText` resolves label -> control through the id, so a stale
      // duplicate would either throw or return the other form's element.
      const amount = scope.getByLabelText("Amount");
      const date = scope.getByLabelText("Date");
      const description = scope.getByLabelText("Description");

      expect(form.contains(amount)).toBe(true);
      expect(form.contains(date)).toBe(true);
      expect(form.contains(description)).toBe(true);
    }
  });

  it("gives the two forms genuinely different ids for the same field", () => {
    renderWith(
      <div>
        <IncomeForm workspaceId="w1" role="owner" currency="SAR" />
        <IncomeForm workspaceId="w1" role="owner" currency="SAR" record={savedIncome} />
      </div>,
    );

    const forms = Array.from(document.querySelectorAll("form"));
    const amountIds = forms.map((form) => within(form as HTMLElement).getByLabelText("Amount").id);

    expect(amountIds[0]).toBeTruthy();
    expect(amountIds[0]).not.toBe(amountIds[1]);
  });

  it("keeps the amount hint linked to its own instance's input", () => {
    renderWith(
      <div>
        <IncomeForm workspaceId="w1" role="owner" currency="SAR" />
        <IncomeForm workspaceId="w1" role="owner" currency="SAR" record={savedIncome} />
      </div>,
    );

    for (const form of Array.from(document.querySelectorAll("form"))) {
      const scope = form as HTMLElement;
      const amount = within(scope).getByLabelText("Amount");
      const describedBy = amount.getAttribute("aria-describedby");

      expect(describedBy).toBeTruthy();
      // The hint must live in the same form, not resolve to the other one.
      expect(scope.querySelectorAll(`[id="${describedBy}"]`)).toHaveLength(1);
    }
  });
});

// BUG-04: the submit bar was pinned 6rem above the viewport bottom to clear a
// nav that is only ~2.8rem tall, leaving a band in which form fields rendered
// *below* the primary action.
describe("sticky submit bar clears the bottom navigation", () => {
  it("offsets itself by the shared nav height instead of a hardcoded value", () => {
    const { container } = render(<FormFooter>save</FormFooter>);
    const footer = container.firstElementChild as HTMLElement;

    expect(footer.className).toContain("bottom-above-nav");
    expect(footer.className).not.toContain("bottom-24");
  });

  it("stays sticky on mobile but reverts to static flow on desktop", () => {
    const { container } = render(<FormFooter>save</FormFooter>);
    const footer = container.firstElementChild as HTMLElement;

    expect(footer.className).toContain("sticky");
    expect(footer.className).toContain("lg:static");
  });

  it("keeps its own safe-area padding so the action clears the device inset", () => {
    const { container } = render(<FormFooter>save</FormFooter>);
    const footer = container.firstElementChild as HTMLElement;

    expect(footer.className).toContain("env(safe-area-inset-bottom)");
  });
});
