import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { OfflineBanner } from "@/components/connectivity/OfflineBanner";
import { StaleDataNotice } from "@/components/connectivity/StaleDataNotice";
import enMessages from "@/messages/en.json";

const useConnectivityMock = vi.hoisted(() => vi.fn());
vi.mock("@/components/connectivity/ConnectivityProvider", () => ({ useConnectivity: useConnectivityMock }));

describe("offline banner and stale data notice", () => {
  it("shows a translated persistent banner and cached-data label while offline", () => {
    useConnectivityMock.mockReturnValue({ status: "offline", canMutate: false, lastOnlineAt: new Date("2026-01-02T03:04:05Z") });
    render(<NextIntlClientProvider locale="en" messages={enMessages}><OfflineBanner /><StaleDataNotice /></NextIntlClientProvider>);
    expect(screen.getByRole("status")).toHaveTextContent("You are offline");
    expect(screen.getByText(/Cached - last updated/)).toBeVisible();
  });
});
