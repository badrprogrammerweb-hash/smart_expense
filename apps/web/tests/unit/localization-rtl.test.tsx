import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import { LocaleDirectionSync } from "@/components/layout/LocaleDirectionSync";
import { toDisplayAmount } from "@/lib/money";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

type Locale = "en" | "ar";

function renderDirectionSync(locale: Locale) {
  const messages = locale === "ar" ? arMessages : enMessages;

  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleDirectionSync />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("dir");
  document.documentElement.removeAttribute("lang");
});

describe("Arabic/English localization and RTL", () => {
  it.each([
    ["ar", "rtl"],
    ["en", "ltr"],
  ] as const)("sets html dir=%s for %s", (locale, direction) => {
    renderDirectionSync(locale);

    expect(document.documentElement).toHaveAttribute("lang", locale);
    expect(document.documentElement).toHaveAttribute("dir", direction);
  });

  it("formats integer minor units as SAR for English and Arabic", () => {
    const englishAmount = toDisplayAmount(123456, "en", "SAR");
    const arabicAmount = toDisplayAmount(123456, "ar", "SAR");

    expect(englishAmount).toMatch(/SAR\s*1,234\.56/);
    expect(arabicAmount).not.toBe(englishAmount);
    expect(new Intl.NumberFormat("en", { style: "currency", currency: "SAR" }).resolvedOptions().currency).toBe(
      "SAR",
    );
    expect(new Intl.NumberFormat("ar", { style: "currency", currency: "SAR" }).resolvedOptions().currency).toBe(
      "SAR",
    );
  });

  it("provides translated labels instead of raw message keys on core surfaces", () => {
    const labels = [
      ["nav.dashboard", enMessages.nav.dashboard, arMessages.nav.dashboard],
      ["records.addIncome", enMessages.records.addIncome, arMessages.records.addIncome],
      ["records.addExpense", enMessages.records.addExpense, arMessages.records.addExpense],
      ["reports.title", enMessages.reports.title, arMessages.reports.title],
      ["history.title", enMessages.history.title, arMessages.history.title],
      ["settings.title", enMessages.settings.title, arMessages.settings.title],
      ["extraction.queue.emptyState", enMessages.extraction.queue.emptyState, arMessages.extraction.queue.emptyState],
    ] as const;

    for (const [key, english, arabic] of labels) {
      expect(english).not.toBe(key);
      expect(arabic).not.toBe(key);
      expect(english).not.toMatch(/^[a-z]+(?:\.[a-z]+)+$/);
      expect(arabic).not.toMatch(/^[a-z]+(?:\.[a-z]+)+$/);
    }
  });
});
