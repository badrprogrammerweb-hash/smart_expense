import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorState } from "@/components/ui/error-state";
import { PermissionDeniedState } from "@/components/ui/permission-denied-state";
import { Skeleton } from "@/components/ui/skeleton";

describe("feedback primitives", () => {
  it("explains errors and permissions without color alone", () => {
    render(
      <>
        <ErrorState description="Check your connection." />
        <PermissionDeniedState
          role="Viewer"
          action="edit expenses"
          title="Permission required"
          description="Viewer users cannot edit expenses. Ask a workspace Owner or Admin for help."
        />
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Check your connection.");
    expect(screen.getByText(/Viewer users cannot edit expenses/)).toBeVisible();
  });

  it("requires an explicit, translated retry label instead of a hardcoded default (FR-006)", () => {
    // Regression guard: the primitive renders no useTranslations of its own,
    // so it must never fall back to hardcoded English when a caller wires up
    // a retry action — every caller must supply its own translated label.
    const retry = vi.fn();
    render(<ErrorState description="Could not load records." retry={retry} retryLabel="إعادة المحاولة" />);
    const retryButton = screen.getByRole("button", { name: "إعادة المحاولة" });
    expect(retryButton).toBeVisible();
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
    // Touch-target minimum (contract T-1) -- this primitive is reused by
    // seven-plus screens (category, expense/income history, AI settings,
    // reports, files), so fixing it here covers all of them at once.
    expect(retryButton.className).toMatch(/\bmin-h-11\b/);
  });

  it("announces loading skeletons", () => { render(<Skeleton />); expect(screen.getByRole("status", { name: "Loading content" })).toBeVisible(); });
});
