import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FileUpload } from "@/components/ui/file-upload";

const isNativeMock = vi.hoisted(() => vi.fn());
const nativeCameraMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/platform/capacitor", () => ({
  isNative: isNativeMock,
  nativeCamera: nativeCameraMock,
}));

afterEach(() => {
  cleanup();
  isNativeMock.mockReset();
  nativeCameraMock.mockReset();
});

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

// T038: the standard `capture` file-input attribute is unreliable on iOS
// WKWebView, so the native shell must prefer the native camera plugin over
// it — falling back to the web capture attribute only when the native
// bridge is unavailable (FR-020).
describe("native-capture FileUpload", () => {
  it("renders a native capture button (not a file input) regardless of pointer/matchMedia, and stages the captured file", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
    isNativeMock.mockReturnValue(true);
    const file = new File(["photo"], "capture-1.jpg", { type: "image/jpeg" });
    const capture = vi.fn().mockResolvedValue({ status: "captured", file });
    nativeCameraMock.mockReturnValue(capture);
    const onFileSelected = vi.fn();

    render(<FileUpload label="Choose file" captureLabel="Take a photo" onFileSelected={onFileSelected} />);

    const captureControl = screen.getByRole("button", { name: "Take a photo" });
    expect(screen.queryByLabelText("Take a photo", { selector: "input" })).not.toBeInTheDocument();

    fireEvent.click(captureControl);

    await waitFor(() => expect(onFileSelected).toHaveBeenCalledWith(file));
    expect(screen.getByText("capture-1.jpg")).toBeVisible();
  });

  // A fast double-tap must not fire a second concurrent takePhoto() before
  // the native camera screen has visibly taken over — the same
  // duplicate-invocation risk the upload button already guards against.
  it("disables the capture button while a capture is in flight and ignores a second tap", async () => {
    isNativeMock.mockReturnValue(true);
    let resolveCapture: (outcome: { status: "captured"; file: File }) => void = () => undefined;
    const capture = vi.fn().mockReturnValue(new Promise((resolve) => { resolveCapture = resolve; }));
    nativeCameraMock.mockReturnValue(capture);

    render(<FileUpload label="Choose file" captureLabel="Take a photo" onFilesSelected={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Take a photo" });

    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.click(button);

    resolveCapture({ status: "captured", file: new File(["photo"], "capture-2.jpg", { type: "image/jpeg" }) });
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(capture).toHaveBeenCalledOnce();
  });

  it("leaves the form unchanged with no error when the native capture is cancelled", async () => {
    isNativeMock.mockReturnValue(true);
    const capture = vi.fn().mockResolvedValue({ status: "cancelled" });
    nativeCameraMock.mockReturnValue(capture);
    const onFileSelected = vi.fn();
    const onCaptureError = vi.fn();

    render(<FileUpload label="Choose file" captureLabel="Take a photo" onFileSelected={onFileSelected} onCaptureError={onCaptureError} />);
    fireEvent.click(screen.getByRole("button", { name: "Take a photo" }));

    await waitFor(() => expect(capture).toHaveBeenCalledOnce());
    expect(onFileSelected).not.toHaveBeenCalled();
    expect(onCaptureError).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Remove file" })).not.toBeInTheDocument();
  });

  it.each(["permission-denied", "unavailable", "failed"] as const)(
    "reports a %s native capture failure without staging a file",
    async (reason) => {
      isNativeMock.mockReturnValue(true);
      const capture = vi.fn().mockResolvedValue({ status: reason });
      nativeCameraMock.mockReturnValue(capture);
      const onCaptureError = vi.fn();

      render(<FileUpload label="Choose file" captureLabel="Take a photo" onFilesSelected={vi.fn()} onCaptureError={onCaptureError} />);
      fireEvent.click(screen.getByRole("button", { name: "Take a photo" }));

      await waitFor(() => expect(onCaptureError).toHaveBeenCalledWith(reason));
      expect(screen.queryByRole("button", { name: "Remove file" })).not.toBeInTheDocument();
    },
  );

  it("falls back to the web capture affordance (no dead control) when native is unavailable but the platform is native", () => {
    Object.defineProperty(HTMLInputElement.prototype, "capture", { configurable: true, value: "" });
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    isNativeMock.mockReturnValue(true);
    nativeCameraMock.mockReturnValue(null);

    render(<FileUpload label="Choose file" captureLabel="Take a photo" onFilesSelected={vi.fn()} />);

    expect(screen.getByLabelText("Take a photo")).toHaveAttribute("capture", "environment");
  });
});
