import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExpenseForm } from "@/components/expense/ExpenseForm";
import { IncomeForm } from "@/components/income/IncomeForm";
import type { IncomeRecord } from "@/lib/api/incomes";
import arMessages from "@/messages/ar.json";
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

function renderWithMessages(ui: ReactNode, locale: "en" | "ar" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

async function submitAmount(value: string) {
  fireEvent.change(screen.getByLabelText(/Amount|المبلغ/), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /Save|حفظ/ }));
}

const savedIncome: IncomeRecord = {
  id: "income-1",
  amount_minor: 12345,
  currency: "SAR",
  occurred_on: "2026-08-07",
  description: "Consulting",
  category_id: null,
  status: "confirmed",
  created_at: "2026-08-07T09:00:00Z",
} as IncomeRecord;

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
    renderWithMessages(<IncomeForm workspaceId="workspace-1" role="owner" currency="SAR" />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // An empty field is a missing amount, not a non-positive one (BUG-01).
    expect(await screen.findByText("Enter an amount.")).toBeInTheDocument();
    expect(createIncomeMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createIncomeMock).not.toHaveBeenCalled());
  });

  it("rejects a missing income date before calling the API", async () => {
    renderWithMessages(<IncomeForm workspaceId="workspace-1" role="owner" currency="SAR" />);

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a valid date.")).toBeInTheDocument();
    expect(createIncomeMock).not.toHaveBeenCalled();
  });

  it("rejects missing and non-positive expense amounts before calling the API", async () => {
    renderWithMessages(<ExpenseForm workspaceId="workspace-1" role="member" currency="SAR" />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter an amount.")).toBeInTheDocument();
    expect(createExpenseMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createExpenseMock).not.toHaveBeenCalled());
  });

  it("rejects a missing expense date before calling the API", async () => {
    renderWithMessages(<ExpenseForm workspaceId="workspace-1" role="member" currency="SAR" />);

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a valid date.")).toBeInTheDocument();
    expect(createExpenseMock).not.toHaveBeenCalled();
  });
});

// BUG-01: every rejection used to produce "Enter an amount greater than zero.",
// which is false for five of the six ways an amount can be wrong.
describe("amount rejection messages name the rule that was actually broken", () => {
  beforeEach(() => {
    createIncomeMock.mockReset();
    updateIncomeMock.mockReset();
    createExpenseMock.mockReset();
    updateExpenseMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("explains SAR's 2-decimal limit for a 3-decimal amount", async () => {
    renderWithMessages(<IncomeForm workspaceId="workspace-1" role="owner" currency="SAR" />);

    await submitAmount("100.993");

    expect(
      await screen.findByText("SAR supports a maximum of 2 decimal places."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Enter an amount greater than zero.")).not.toBeInTheDocument();
    expect(createIncomeMock).not.toHaveBeenCalled();
  });

  it("accepts the same 3-decimal amount in a KWD workspace", async () => {
    renderWithMessages(<IncomeForm workspaceId="workspace-1" role="owner" currency="KWD" />);

    await submitAmount("100.993");

    await waitFor(() => expect(createIncomeMock).toHaveBeenCalledTimes(1));
    expect(createIncomeMock.mock.calls[0][0]).toMatchObject({ amount_minor: 100993 });
  });

  it("explains KWD's 3-decimal limit for a 4-decimal amount", async () => {
    renderWithMessages(<IncomeForm workspaceId="workspace-1" role="owner" currency="KWD" />);

    await submitAmount("100.9934");

    expect(
      await screen.findByText("KWD supports a maximum of 3 decimal places."),
    ).toBeInTheDocument();
    expect(createIncomeMock).not.toHaveBeenCalled();
  });

  it("distinguishes empty, zero, negative, non-numeric and oversized amounts", async () => {
    const expectations: Array<[string, string]> = [
      ["", "Enter an amount."],
      ["0", "Enter an amount greater than zero."],
      ["-50", "Enter an amount greater than zero."],
      ["abc", "Enter a valid amount."],
      ["999999999999999999999", "That amount is too large. Enter a smaller amount."],
    ];

    for (const [value, message] of expectations) {
      renderWithMessages(<IncomeForm workspaceId="workspace-1" role="owner" currency="SAR" />);
      await submitAmount(value);

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(createIncomeMock).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("applies the same rules to the expense form", async () => {
    renderWithMessages(<ExpenseForm workspaceId="workspace-1" role="member" currency="SAR" />);

    await submitAmount("100.993");

    expect(
      await screen.findByText("SAR supports a maximum of 2 decimal places."),
    ).toBeInTheDocument();
    expect(createExpenseMock).not.toHaveBeenCalled();
  });

  it("applies the same rules when editing an existing record", async () => {
    renderWithMessages(
      <IncomeForm workspaceId="workspace-1" role="owner" currency="SAR" record={savedIncome} />,
    );

    await submitAmount("100.993");

    expect(
      await screen.findByText("SAR supports a maximum of 2 decimal places."),
    ).toBeInTheDocument();
    expect(updateIncomeMock).not.toHaveBeenCalled();
  });

  it("localizes the precision rule in Arabic, using the dual form for two places", async () => {
    renderWithMessages(
      <IncomeForm workspaceId="workspace-1" role="owner" currency="SAR" />,
      "ar",
    );

    await submitAmount("100.993");

    // Arabic has a dedicated dual: "منزلتين عشريتين" carries the count, so no
    // numeral appears. A `{digits}` placeholder would wrongly read "2 منازل".
    expect(
      await screen.findByText("تسمح عملة SAR بحد أقصى منزلتين عشريتين."),
    ).toBeInTheDocument();
  });

  it("uses the Arabic plural form for a three-decimal currency", async () => {
    renderWithMessages(
      <IncomeForm workspaceId="workspace-1" role="owner" currency="KWD" />,
      "ar",
    );

    await submitAmount("100.9934");

    expect(await screen.findByText("تسمح عملة KWD بحد أقصى 3 منازل عشرية.")).toBeInTheDocument();
  });

  it("states the decimal rule before submission, linked to the amount field", () => {
    const { container } = renderWithMessages(
      <IncomeForm workspaceId="workspace-1" role="owner" currency="KWD" />,
    );

    const hint = screen.getByText("Up to 3 decimal places.");
    const amountInput = screen.getByLabelText("Amount");

    expect(amountInput).toHaveAttribute("aria-describedby", hint.id);
    expect(container.querySelectorAll(`#${CSS.escape(hint.id)}`)).toHaveLength(1);
  });

  it("states the Arabic decimal hint with the dual form for a 2-decimal currency", () => {
    renderWithMessages(<IncomeForm workspaceId="workspace-1" role="owner" currency="SAR" />, "ar");

    expect(screen.getByText("حتى منزلتين عشريتين.")).toBeInTheDocument();
  });
});
