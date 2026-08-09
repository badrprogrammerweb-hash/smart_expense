import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IncomeForm } from "@/components/income/IncomeForm";
import { ApiError, ConnectivityError } from "@/lib/api/client";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

// BUG-06: `parseError` puts the server's own `error.message` on `ApiError`,
// and the forms rendered it verbatim — English operator text on an Arabic
// screen, including internal hostnames and ports.
const INTERNAL_LEAK = "Database connection pool exhausted at pg_bouncer:6432";

const createIncomeMock = vi.hoisted(() => vi.fn());
const updateIncomeMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-incomes", () => ({
  useCreateIncome: () => ({ mutateAsync: createIncomeMock, isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: updateIncomeMock, isPending: false }),
}));

vi.mock("@/hooks/use-categories", () => ({
  useCategories: () => ({ data: { categories: [] }, isLoading: false }),
}));

function renderWithMessages(ui: ReactNode, locale: "en" | "ar" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

async function saveIncome(locale: "en" | "ar" = "en") {
  renderWithMessages(<IncomeForm workspaceId="workspace-1" role="owner" currency="SAR" />, locale);
  fireEvent.change(screen.getByLabelText(/Amount|المبلغ/), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: /Save|حفظ/ }));
}

describe("server error text never reaches the interface", () => {
  beforeEach(() => {
    createIncomeMock.mockReset();
    updateIncomeMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("replaces an unknown 5xx body with a safe localized fallback", async () => {
    createIncomeMock.mockRejectedValue(new ApiError(500, "error", INTERNAL_LEAK));

    await saveIncome();

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(INTERNAL_LEAK)).not.toBeInTheDocument();
  });

  it("leaks no fragment of the internal host, port or driver detail", async () => {
    createIncomeMock.mockRejectedValue(new ApiError(500, "error", INTERNAL_LEAK));

    await saveIncome();

    await screen.findByText("Something went wrong. Please try again.");

    const rendered = document.body.textContent ?? "";
    ["pg_bouncer", "6432", "connection pool", "Database connection"].forEach((fragment) => {
      expect(rendered).not.toContain(fragment);
    });
  });

  it("shows Arabic copy on the Arabic form rather than the English server string", async () => {
    createIncomeMock.mockRejectedValue(new ApiError(503, "database_unavailable", INTERNAL_LEAK));

    await saveIncome("ar");

    expect(
      await screen.findByText("الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل."),
    ).toBeInTheDocument();
    expect(screen.queryByText(INTERNAL_LEAK)).not.toBeInTheDocument();
  });

  it("keeps structured validation the backend intends the client to explain", async () => {
    // Mapped by code, not by matching the server's English string — so this
    // copy stays correct and localized even when the backend rewords it.
    createIncomeMock.mockRejectedValue(
      new ApiError(422, "category_archived", "Category is archived."),
    );

    await saveIncome();

    expect(await screen.findByText("That category is archived.")).toBeInTheDocument();
  });

  it("localizes a connectivity failure instead of showing the fetch error", async () => {
    createIncomeMock.mockRejectedValue(new ConnectivityError("getaddrinfo ENOTFOUND api.internal"));

    await saveIncome("ar");

    expect(
      await screen.findByText("تعذّر إكمال الطلب. تحقق من اتصالك وحاول مرة أخرى."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ENOTFOUND/)).not.toBeInTheDocument();
  });

  it("falls back safely for a thrown value that is not an Error at all", async () => {
    createIncomeMock.mockRejectedValue({ detail: INTERNAL_LEAK });

    await saveIncome();

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });
});
