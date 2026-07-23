import { fireEvent, render, screen } from "@testing-library/react";
import { Home, Menu } from "lucide-react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { BottomNav, type BottomNavItem } from "@/components/ui/bottom-nav";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a> }));

function items(count: number): BottomNavItem[] {
  return Array.from({ length: count }, (_, index) => ({ href: `/item-${index}`, label: `Item ${index}`, icon: index ? Menu : Home, active: index === 0 }));
}

describe("BottomNav", () => {
  it("renders four focusable destinations, an active item, and more", () => {
    const more = vi.fn();
    render(<BottomNav moreLabel="More" navLabel="Mobile navigation" onMore={more} items={items(5)} />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Item 0" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(more).toHaveBeenCalledOnce();
  });

  it("splits overflow into the four-plus-more shape regardless of how many destinations are passed", () => {
    render(<BottomNav moreLabel="More" navLabel="Mobile navigation" onMore={() => {}} items={items(9)} />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("renders exactly the role-permitted destinations it is given, never padding or adding extras", () => {
    // BottomNav does not filter by role itself (N-4: "role filtering is
    // unchanged") -- the caller (WorkspaceShell) passes an already
    // role-filtered list, e.g. a Viewer with only 2 permitted destinations.
    // This proves the presentational layer renders that list verbatim
    // rather than padding it out to 4.
    render(<BottomNav moreLabel="More" navLabel="Mobile navigation" onMore={() => {}} items={items(2)} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/item-0", "/item-1"]);
  });

  it("keeps every destination and the more control keyboard focusable", () => {
    render(<BottomNav moreLabel="More" navLabel="Mobile navigation" onMore={() => {}} items={items(4)} />);
    const controls = [...screen.getAllByRole("link"), screen.getByRole("button", { name: "More" })];
    for (const control of controls) {
      control.focus();
      expect(document.activeElement).toBe(control);
    }
  });

  it("uses only logical CSS properties, with no hardcoded physical-direction utility that would break RTL mirroring", () => {
    render(<BottomNav moreLabel="More" navLabel="Mobile navigation" onMore={() => {}} items={items(4)} />);
    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    const physicalDirectionClass = /\b(ml-|mr-|pl-|pr-|left-|right-|text-left|text-right|order-)/;
    expect(nav.className).not.toMatch(physicalDirectionClass);
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).not.toMatch(physicalDirectionClass);
    }
  });
});
