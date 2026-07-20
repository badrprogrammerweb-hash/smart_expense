import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExpenseForm } from "@/components/expense/ExpenseForm";
import { IncomeForm } from "@/components/income/IncomeForm";
import messages from "@/messages/en.json";

const createIncomeMock = vi.hoisted(() => vi.fn());
const createExpenseMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-incomes", () => ({
  useCreateIncome: () => ({ mutateAsync: createIncomeMock, isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-expenses", () => ({
  useCreateExpense: () => ({ mutateAsync: createExpenseMock, isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: () => ({ data: { categories: [] }, isLoading: false }),
}));

function renderWithMessages(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

// A never-resolving promise keeps the mutation "in flight" for the duration
// of the test, so a real duplicate call is on the hook if the guard fails.
function pendingMutation() {
  return new Promise<void>(() => {});
}

describe("income and expense double-submit protection", () => {
  beforeEach(() => {
    createIncomeMock.mockReset();
    createExpenseMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("submits an income record only once when Save is clicked twice in the same tick", async () => {
    createIncomeMock.mockImplementation(pendingMutation);
    renderWithMessages(<IncomeForm workspaceId="workspace-1" role="owner" currency="SAR" />);

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-01-01" } });

    const saveButton = screen.getByRole("button", { name: "Save" });
    // Both clicks fire synchronously in the same call stack, before React
    // can flush the isSubmitting update that disables the button — the
    // actual race a fast real double-click can hit, which a Playwright
    // dblclick() (two separate CDP round-trips) is too slow to reproduce
    // reliably.
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    await waitFor(() => expect(createIncomeMock).toHaveBeenCalled());
    expect(createIncomeMock).toHaveBeenCalledTimes(1);
  });

  it("submits an expense record only once when Save is clicked twice in the same tick", async () => {
    createExpenseMock.mockImplementation(pendingMutation);
    renderWithMessages(<ExpenseForm workspaceId="workspace-1" role="member" currency="SAR" />);

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-01-01" } });

    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    await waitFor(() => expect(createExpenseMock).toHaveBeenCalled());
    expect(createExpenseMock).toHaveBeenCalledTimes(1);
  });
});
