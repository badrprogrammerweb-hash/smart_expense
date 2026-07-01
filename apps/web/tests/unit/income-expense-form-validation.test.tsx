import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExpenseForm } from "@/components/expense/ExpenseForm";
import { IncomeForm } from "@/components/income/IncomeForm";
import messages from "@/messages/en.json";

const createIncomeMock = vi.hoisted(() => vi.fn());
const updateIncomeMock = vi.hoisted(() => vi.fn());
const createExpenseMock = vi.hoisted(() => vi.fn());
const updateExpenseMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-incomes", () => ({
  useCreateIncome: () => ({ mutateAsync: createIncomeMock, isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: updateIncomeMock, isPending: false }),
}));

vi.mock("@/hooks/use-expenses", () => ({
  useCreateExpense: () => ({ mutateAsync: createExpenseMock, isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: updateExpenseMock, isPending: false }),
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

describe("income and expense form validation", () => {
  beforeEach(() => {
    createIncomeMock.mockReset();
    updateIncomeMock.mockReset();
    createExpenseMock.mockReset();
    updateExpenseMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("rejects missing and non-positive income amounts before calling the API", async () => {
    renderWithMessages(<IncomeForm workspaceId="workspace-1" role="owner" />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter an amount greater than zero.")).toBeInTheDocument();
    expect(createIncomeMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createIncomeMock).not.toHaveBeenCalled());
  });

  it("rejects a missing income date before calling the API", async () => {
    renderWithMessages(<IncomeForm workspaceId="workspace-1" role="owner" />);

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a valid date.")).toBeInTheDocument();
    expect(createIncomeMock).not.toHaveBeenCalled();
  });

  it("rejects missing and non-positive expense amounts before calling the API", async () => {
    renderWithMessages(<ExpenseForm workspaceId="workspace-1" role="member" />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter an amount greater than zero.")).toBeInTheDocument();
    expect(createExpenseMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createExpenseMock).not.toHaveBeenCalled());
  });

  it("rejects a missing expense date before calling the API", async () => {
    renderWithMessages(<ExpenseForm workspaceId="workspace-1" role="member" />);

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a valid date.")).toBeInTheDocument();
    expect(createExpenseMock).not.toHaveBeenCalled();
  });
});
