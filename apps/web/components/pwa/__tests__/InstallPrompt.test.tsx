import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import type { InstallCapabilityState } from "@/lib/pwa/install";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

const useInstallCapabilityMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/pwa/install", () => ({
  useInstallCapability: useInstallCapabilityMock,
}));

function state(capability: InstallCapabilityState["capability"]): InstallCapabilityState {
  return {
    capability,
    deferredPrompt:
      capability === "promptable"
        ? { prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: "dismissed" }) }
        : null,
    dismissedThisSession: false,
    dismiss: vi.fn(),
    prompt: vi.fn().mockResolvedValue(undefined),
  };
}

function renderWithLocale(locale: "en" | "ar", ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? enMessages : arMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  useInstallCapabilityMock.mockReset();
});

describe("InstallPrompt", () => {
  it.each([
    ["en", "Install app", "Not now", "Open your browser menu and choose Add to Home Screen."],
    ["ar", "تثبيت التطبيق", "ليس الآن", "افتح قائمة المتصفح واختر إضافة إلى الشاشة الرئيسية."],
  ] as const)("renders promptable and manual install affordances in %s", (locale, action, dismiss, instructions) => {
    const promptable = state("promptable");
    useInstallCapabilityMock.mockReturnValue(promptable);
    const { rerender } = renderWithLocale(locale, <InstallPrompt />);

    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(promptable.prompt).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: dismiss }));
    expect(promptable.dismiss).toHaveBeenCalledOnce();

    const manual = state("manual");
    useInstallCapabilityMock.mockReturnValue(manual);
    rerender(
      <NextIntlClientProvider locale={locale} messages={locale === "en" ? enMessages : arMessages}>
        <InstallPrompt />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(instructions)).toBeVisible();
    expect(screen.queryByRole("button", { name: action })).not.toBeInTheDocument();
  });

  it.each([
    ["en", "installed"],
    ["ar", "installed"],
    ["en", "unsupported"],
    ["ar", "unsupported"],
  ] as const)("renders nothing in %s when %s", (locale, capability) => {
    useInstallCapabilityMock.mockReturnValue(state(capability));
    const { container } = renderWithLocale(locale, <InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  // FR-005: dismissing the banner must not cost the user their way to install —
  // the Settings entry is the durable path and ignores the session dismissal.
  it.each(["en", "ar"] as const)("keeps the settings entry after dismissal in %s", (locale) => {
    useInstallCapabilityMock.mockReturnValue({ ...state("promptable"), dismissedThisSession: true });

    const banner = renderWithLocale(locale, <InstallPrompt />);
    expect(banner.container).toBeEmptyDOMElement();
    cleanup();

    renderWithLocale(locale, <InstallPrompt placement="settings" />);
    expect(screen.getByTestId("settings-install-entry")).toBeVisible();
  });
});
