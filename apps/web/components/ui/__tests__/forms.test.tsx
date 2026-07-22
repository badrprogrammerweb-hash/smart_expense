import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AmountInput } from "@/components/ui/amount-input";
import { DateField } from "@/components/ui/date-field";
import { FileUpload } from "@/components/ui/file-upload";
import { FormError } from "@/components/ui/form-field";

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
});
