import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AmountInput } from "@/components/ui/amount-input";
import { DateField } from "@/components/ui/date-field";
import { FileUpload } from "@/components/ui/file-upload";
import { FormError, FormFooter } from "@/components/ui/form-field";

describe("form primitives", () => {
  it("uses a decimal keyboard and preserves amount grouping in RTL", () => {
    render(<AmountInput currency="SAR" sign="-" aria-label="Amount" />);
    expect(screen.getByLabelText("Amount")).toHaveAttribute("inputmode", "decimal");
    expect(screen.getByText("SAR").parentElement).toHaveAttribute("dir", "ltr");
  });

  it("renders date fields through the shared display formatter", () => {
    render(<DateField aria-label="Date" value="2026-07-13T00:00:00.000Z" readOnly />);
    expect(screen.getByLabelText("Date")).toHaveValue("13/07/2026");
  });

  it("returns selected files and exposes errors to assistive technology", () => {
    const onFilesSelected = vi.fn();
    render(<><FileUpload label="Upload receipt" onFilesSelected={onFilesSelected} /><FormError>File is required</FormError></>);
    fireEvent.change(screen.getByLabelText("Upload receipt"), { target: { files: [new File(["x"], "receipt.pdf")] } });
    expect(onFilesSelected).toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("File is required");
  });

  it("sticks the form footer above the fixed bottom nav with safe-area bottom padding, reverting to static flow at `lg` (contract K-1/S-2a)", () => {
    render(<FormFooter data-testid="footer">submit</FormFooter>);
    const footer = screen.getByTestId("footer");
    expect(footer.className).toMatch(/\bsticky\b/);
    expect(footer.className).toMatch(/\bbottom-24\b/);
    expect(footer.className).toMatch(/pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/);
    expect(footer.className).toMatch(/\blg:static\b/);
  });
});
