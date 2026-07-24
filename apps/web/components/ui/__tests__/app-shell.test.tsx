import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/ui/app-shell";

// T054/FR-029, contracts: safe-area CSS rules existing in globals.css proves
// nothing on their own — this renders the real component and asserts the
// utility classes are actually applied to the outer container, the one
// element every screen shares. Physical (not logical) properties are
// required: pairing padding-inline-start with safe-area-inset-left would
// swap the insets under RTL and clip content on the notched side in Arabic
// landscape (see globals.css's own comment on this exact point) — so this
// also pins the class names to the physical variants, not a logical
// equivalent a future refactor might substitute.
describe("AppShell", () => {
  it("applies the physical safe-area utility classes to the outer container", () => {
    render(
      <AppShell sidebar={<div>sidebar</div>} header={<div>header</div>} bottomNav={<div>nav</div>}>
        <div>content</div>
      </AppShell>,
    );

    const container = screen.getByText("content").closest(".full-height-dvh");
    expect(container).not.toBeNull();
    expect(container?.className).toMatch(/\bsafe-area-block-start\b/);
    expect(container?.className).toMatch(/\bsafe-area-block-end\b/);
    expect(container?.className).toMatch(/\bsafe-area-x\b/);
    // Logical variants would break RTL landscape (see globals.css) — assert
    // they are specifically absent, not just that the physical ones exist.
    expect(container?.className).not.toMatch(/\bsafe-area-inline\b/);
  });

  it("renders bottomNav content so the safe-area-x bottom nav sits inside the safe-area container", () => {
    render(
      <AppShell sidebar={<div>sidebar</div>} header={<div>header</div>} bottomNav={<nav data-testid="bottom-nav">nav</nav>}>
        <div>content</div>
      </AppShell>,
    );

    const container = screen.getByText("content").closest(".full-height-dvh");
    expect(container).not.toBeNull();
    expect(screen.getByTestId("bottom-nav")).toBeVisible();
    expect(container?.contains(screen.getByTestId("bottom-nav"))).toBe(true);
  });
});
