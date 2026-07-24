"use client";

import { Camera, Upload, X } from "lucide-react";
import { useEffect, useId, useMemo, useState, type ChangeEvent, type InputHTMLAttributes } from "react";

import { isNative, nativeCamera, type CameraCaptureOutcome } from "@/lib/platform/capacitor";
import { cn } from "@/lib/utils";

export type CaptureFailureReason = Exclude<CameraCaptureOutcome["status"], "captured" | "cancelled">;

export type FileUploadProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  label: string;
  captureLabel?: string;
  removeLabel?: string;
  previewLabel?: string;
  resetKey?: number;
  onFilesSelected?: (files: FileList) => void;
  onFileSelected?: (file: File | undefined) => void;
  /** Native capture only: not called for a user-cancelled capture (FR-022 — the form stays unchanged, silently). */
  onCaptureError?: (reason: CaptureFailureReason) => void;
};

function supportsCapture() {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  return "capture" in document.createElement("input") && window.matchMedia("(pointer: coarse)").matches;
}

function supportsNativeCapture() {
  return isNative() && nativeCamera() !== null;
}

function formatSize(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ label, captureLabel, removeLabel = "Remove file", previewLabel = "Selected file preview", resetKey, className, id, onFilesSelected, onFileSelected, onCaptureError, disabled, accept, ...props }: FileUploadProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const captureId = `${inputId}-capture`;
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  // Reliability, not preference: the standard `capture` file-input attribute
  // is unreliable on iOS WKWebView (the reason @capacitor/camera exists at
  // all), so the native shell always prefers the native camera plugin over
  // the web capture attribute when both are technically present.
  const nativeCaptureAvailable = useMemo(supportsNativeCapture, []);
  const captureAvailable = useMemo(supportsCapture, []);

  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);
  useEffect(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
    setFile(null);
  }, [resetKey]);

  function select(next: File | undefined) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(next?.type.startsWith("image/") ? URL.createObjectURL(next) : null);
    setFile(next ?? null);
    onFileSelected?.(next);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    select(selected);
    onFilesSelected?.(event.target.files!);
  }

  async function handleNativeCapture() {
    const capture = nativeCamera();
    // isCapturing guards against a fast double-tap firing a second concurrent
    // takePhoto() before the native camera screen has visibly taken over —
    // the same duplicate-invocation risk the upload button already guards
    // against via isUploading.
    if (!capture || disabled || isCapturing) return;
    setIsCapturing(true);
    try {
      const outcome = await capture();
      if (outcome.status === "captured") {
        select(outcome.file);
        return;
      }
      // A cancelled capture leaves the form unchanged with no partial file
      // staged and no error shown (spec.md Edge Cases) — every other outcome
      // is a real failure the caller should explain.
      if (outcome.status !== "cancelled") {
        onCaptureError?.(outcome.status);
      }
    } finally {
      setIsCapturing(false);
    }
  }

  function remove() {
    select(undefined);
    const picker = document.getElementById(inputId) as HTMLInputElement | null;
    const capture = document.getElementById(captureId) as HTMLInputElement | null;
    if (picker) picker.value = "";
    if (capture) capture.value = "";
  }

  const captureButtonClassName = cn(
    "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)] focus-within:shadow-[var(--shadow-focus)]",
    disabled && "cursor-not-allowed opacity-60",
  );
  // Native: no dead control if the bridge is somehow unavailable — fall back
  // to the web capture affordance rather than hiding capture outright (FR-020).
  const captureControl = captureLabel && (nativeCaptureAvailable
    ? <button type="button" className={captureButtonClassName} onClick={() => void handleNativeCapture()} disabled={disabled || isCapturing}><Camera aria-hidden="true" className="size-4" />{captureLabel}</button>
    : captureAvailable
      ? <label htmlFor={captureId} className={captureButtonClassName}><Camera aria-hidden="true" className="size-4" />{captureLabel}<input aria-label={captureLabel} id={captureId} className="sr-only" type="file" accept="image/*" capture="environment" disabled={disabled} onChange={handleChange} /></label>
      : null);

  return <div className={cn("space-y-3", className)}><div className="flex flex-wrap gap-2"><label htmlFor={inputId} className={cn("flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed border-input px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)] focus-within:shadow-[var(--shadow-focus)]", disabled && "cursor-not-allowed opacity-60")}><Upload aria-hidden="true" className="size-4" />{label}<input aria-label={label} id={inputId} className="sr-only" type="file" accept={accept} disabled={disabled} onChange={handleChange} {...props} /></label>{captureControl}</div>{file && <div className="flex items-center gap-3 rounded-md border p-3" aria-label={previewLabel}>{objectUrl && <img src={objectUrl} alt="" className="size-12 rounded object-cover" />}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{formatSize(file.size)}</p></div><button className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border" type="button" onClick={remove} disabled={disabled} aria-label={removeLabel}><X className="size-4" /></button></div>}</div>;
}
