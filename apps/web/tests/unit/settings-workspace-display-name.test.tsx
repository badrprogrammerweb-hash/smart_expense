import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "@/app/[locale]/w/[workspaceId]/settings/page";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

// Everything below is orthogonal to the workspace-info card under test and
// carries its own data fetching (react-query, IAP bridges, etc.); stub it out
// so this stays a focused render of the one section BUG-15 touched.
vi.mock("@/components/settings/AiSettingsCard", () => ({ AiSettingsCard: () => null }));
vi.mock("@/components/settings/SupportPurchaseCard", () => ({ SupportPurchaseCard: () => null }));
vi.mock("@/components/settings/AutoDeleteToggle", () => ({ AutoDeleteToggle: () => null }));
vi.mock("@/components/settings/WorkspaceCurrencySelector", () => ({ WorkspaceCurrencySelector: () => null }));
vi.mock("@/components/settings/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("@/components/pwa/InstallPrompt", () => ({ InstallPrompt: () => null }));

const workspaceContextMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/workspace-context", () => ({ useWorkspaceContext: workspaceContextMock }));

function renderSettings(workspaceName: string, locale: "en" | "ar" = "ar") {
  workspaceContextMock.mockReturnValue({
    autoDeleteAfterExtraction: false,
    currency: "SAR",
    currencyLocked: false,
    memberCount: 1,
    role: "owner",
    workspaceId: "w1",
    workspaceName,
    workspaceType: "personal",
  });

  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : enMessages}>
      <SettingsPage />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

// BUG-15: the "Workspace info" card rendered `workspaceName` raw, so a
// personal workspace read as localized "Personal workspace" in the header
// (WorkspaceSelector) but the untranslated literal "Personal Workspace" here —
// the same inconsistency the finding reports, in a second location.
describe("settings workspace-info card uses the display-name resolver", () => {
  it("shows the localized default name for the seeded personal workspace", () => {
    renderSettings("Personal Workspace", "ar");

    expect(screen.getByText("مساحة العمل الشخصية")).toBeInTheDocument();
    expect(screen.queryByText("Personal Workspace")).not.toBeInTheDocument();
  });

  it("leaves a user-renamed workspace exactly as typed, even in Arabic", () => {
    renderSettings("ميزانيتي", "ar");

    expect(screen.getByText("ميزانيتي")).toBeInTheDocument();
    expect(screen.queryByText("مساحة العمل الشخصية")).not.toBeInTheDocument();
  });
});
