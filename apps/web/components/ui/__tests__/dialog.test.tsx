import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui/dialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Dialog open={open} onOpenChange={setOpen} title="Test dialog">
        content
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("returns focus to the opening control when dismissed via its close control (contract T-4)", () => {
    render(<Harness />);
    const openButton = screen.getByRole("button", { name: "Open" });
    openButton.focus();
    fireEvent.click(openButton);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Two elements share the "Close dialog" aria-label (the backdrop and
    // the icon button) -- only the icon button also carries a `title`.
    fireEvent.click(screen.getByTitle("Close dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(openButton);
  });

  it("returns focus to the opening control when dismissed via Escape (contract T-4)", () => {
    render(<Harness />);
    const openButton = screen.getByRole("button", { name: "Open" });
    openButton.focus();
    fireEvent.click(openButton);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(openButton);
  });

  it("closes on the device back gesture (popstate) without leaving an extra history entry uncleaned (contract T-3)", () => {
    render(<Harness />);
    const startLength = window.history.length;
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Opening pushes one history entry so a real back-gesture fires
    // `popstate` here instead of navigating the underlying page away.
    expect(window.history.length).toBe(startLength + 1);

    fireEvent.popState(window);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("pops its own pushed history entry when closed by its control, so a real back-navigation right after is not swallowed", () => {
    // history.back() navigates asynchronously even in jsdom, so this
    // asserts the mechanism (it is called exactly once) rather than the
    // eventual history.length, which the component's own comment documents
    // as the point of `closedByPopState`.
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByTitle("Close dialog"));
    expect(backSpy).toHaveBeenCalledOnce();
    backSpy.mockRestore();
  });

  it("does not call history.back() again when already closed by the back gesture itself", () => {
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.popState(window);
    expect(backSpy).not.toHaveBeenCalled();
    backSpy.mockRestore();
  });
});
