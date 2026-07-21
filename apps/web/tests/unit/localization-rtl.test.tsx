import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import { LocaleDirectionSync } from "@/components/layout/LocaleDirectionSync";
import { getCategoryLabel } from "@/lib/i18n/category-labels";
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

function CategoryLabelProbe() {
  const t = useTranslations("categories.catalog");
  return (
    <ul>
      <li data-testid="main">{getCategoryLabel(t, { name: "Restaurants", translation_key: "restaurants" })}</li>
      <li data-testid="sub">
        {getCategoryLabel(t, { name: "Dining Out", translation_key: "restaurants.dining_out" })}
      </li>
      <li data-testid="custom">{getCategoryLabel(t, { name: "Pets", translation_key: null })}</li>
    </ul>
  );
}

function renderCategoryLabels(locale: Locale) {
  const messages = locale === "ar" ? arMessages : enMessages;

  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CategoryLabelProbe />
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

  it("formats a non-SAR three-decimal currency in English and Arabic without changing direction state", () => {
    const englishAmount = toDisplayAmount(123456, "en", "KWD");
    const arabicAmount = toDisplayAmount(123456, "ar", "KWD");

    renderDirectionSync("ar");

    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(englishAmount).toMatch(/KWD\s*123\.456/);
    expect(arabicAmount).not.toBe(englishAmount);
    expect(new Intl.NumberFormat("en", { style: "currency", currency: "KWD" }).resolvedOptions().currency).toBe(
      "KWD",
    );
    expect(new Intl.NumberFormat("ar", { style: "currency", currency: "KWD" }).resolvedOptions().currency).toBe(
      "KWD",
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

  it("renders system-provided category/subcategory names translated per locale, while a user-created category name stays literal in both (quickstart.md Section 6)", () => {
    const english = renderCategoryLabels("en");
    const englishMain = english.getByTestId("main").textContent;
    const englishSub = english.getByTestId("sub").textContent;
    const englishCustom = english.getByTestId("custom").textContent;
    english.unmount();

    const arabic = renderCategoryLabels("ar");
    const arabicMain = arabic.getByTestId("main").textContent;
    const arabicSub = arabic.getByTestId("sub").textContent;
    const arabicCustom = arabic.getByTestId("custom").textContent;
    arabic.unmount();

    expect(englishMain).toBe("Restaurants");
    expect(arabicMain).toBe(arMessages.categories.catalog.restaurants);
    expect(arabicMain).not.toBe(englishMain);

    expect(englishSub).toBe("Dining Out");
    expect(arabicSub).toBe(arMessages.categories.catalog.sub.restaurants.dining_out);
    expect(arabicSub).not.toBe(englishSub);

    expect(englishCustom).toBe("Pets");
    expect(arabicCustom).toBe("Pets");
  });
});
