import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FileUpload } from "@/components/ui/file-upload";

afterEach(cleanup);

describe("capture-enabled FileUpload", () => {
  it("shows capture only on a coarse, capture-capable device and revokes previews", () => {
    Object.defineProperty(HTMLInputElement.prototype, "capture", { configurable: true, value: "" });
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:receipt");
    render(<FileUpload label="Choose file" captureLabel="Take a photo" onFilesSelected={vi.fn()} />);
    expect(screen.getByLabelText("Take a photo")).toHaveAttribute("capture", "environment");
    fireEvent.change(screen.getByLabelText("Choose file"), { target: { files: [new File(["image"], "receipt.png", { type: "image/png" })] } });
    expect(screen.getByText("receipt.png")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Remove file" }));
    expect(revoke).toHaveBeenCalledWith("blob:receipt");
  });

  it("does not stage anything when capture is cancelled or unavailable", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
    render(<FileUpload label="Choose file" captureLabel="Take a photo" onFilesSelected={vi.fn()} />);
    expect(screen.queryByLabelText("Take a photo")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Choose file"), { target: { files: [] } });
    expect(screen.queryByText("Remove file")).not.toBeInTheDocument();
  });

  // FR-017: the flow must allow replacing the staged file before confirmation.
  // There is no dedicated "Replace" control — re-selecting via either source is
  // the replace affordance — so this proves that pathway actually swaps the
  // preview (not stacks alongside it) and revokes the superseded object URL.
  it("replaces the staged file (not stacks it) when a second file is selected before confirming, revoking the first preview URL", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    render(<FileUpload label="Choose file" onFilesSelected={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Choose file"), {
      target: { files: [new File(["first"], "first.png", { type: "image/png" })] },
    });
    expect(screen.getByText("first.png")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Choose file"), {
      target: { files: [new File(["second"], "second.png", { type: "image/png" })] },
    });

    expect(screen.queryByText("first.png")).not.toBeInTheDocument();
    expect(screen.getByText("second.png")).toBeVisible();
    expect(revoke).toHaveBeenCalledWith("blob:first");
  });
});
