import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";

describe("overlay primitives", () => {
  it("renders a labelled, modal dialog and closes on escape", () => {
    const onOpenChange = vi.fn();
    render(<Dialog open onOpenChange={onOpenChange} title="Edit income">Content</Dialog>);
    expect(screen.getByRole("dialog", { name: "Edit income" })).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("states the destructive consequence before confirmation", () => {
    render(<ConfirmDialog open onOpenChange={vi.fn()} title="Delete receipt" consequence="This permanently deletes the uploaded receipt." confirmLabel="Delete receipt" onConfirm={vi.fn()} />);
    expect(screen.getByText("This permanently deletes the uploaded receipt.")).toBeVisible();
  });
});
