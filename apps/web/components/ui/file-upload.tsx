"use client";

import { Camera, Upload, X } from "lucide-react";
import { useEffect, useId, useMemo, useState, type ChangeEvent, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type FileUploadProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  label: string;
  captureLabel?: string;
  removeLabel?: string;
  previewLabel?: string;
  resetKey?: number;
  onFilesSelected?: (files: FileList) => void;
  onFileSelected?: (file: File | undefined) => void;
};

function supportsCapture() {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  return "capture" in document.createElement("input") && window.matchMedia("(pointer: coarse)").matches;
}

function formatSize(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ label, captureLabel, removeLabel = "Remove file", previewLabel = "Selected file preview", resetKey, className, id, onFilesSelected, onFileSelected, disabled, accept, ...props }: FileUploadProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const captureId = `${inputId}-capture`;
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
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

  function remove() {
    select(undefined);
    const picker = document.getElementById(inputId) as HTMLInputElement | null;
    const capture = document.getElementById(captureId) as HTMLInputElement | null;
    if (picker) picker.value = "";
    if (capture) capture.value = "";
  }

  return <div className={cn("space-y-3", className)}><div className="flex flex-wrap gap-2"><label htmlFor={inputId} className={cn("flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed border-input px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)] focus-within:shadow-[var(--shadow-focus)]", disabled && "cursor-not-allowed opacity-60")}><Upload aria-hidden="true" className="size-4" />{label}<input aria-label={label} id={inputId} className="sr-only" type="file" accept={accept} disabled={disabled} onChange={handleChange} {...props} /></label>{captureAvailable && captureLabel && <label htmlFor={captureId} className={cn("flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)] focus-within:shadow-[var(--shadow-focus)]", disabled && "cursor-not-allowed opacity-60")}><Camera aria-hidden="true" className="size-4" />{captureLabel}<input aria-label={captureLabel} id={captureId} className="sr-only" type="file" accept="image/*" capture="environment" disabled={disabled} onChange={handleChange} /></label>}</div>{file && <div className="flex items-center gap-3 rounded-md border p-3" aria-label={previewLabel}>{objectUrl && <img src={objectUrl} alt="" className="size-12 rounded object-cover" />}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{formatSize(file.size)}</p></div><button className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border" type="button" onClick={remove} disabled={disabled} aria-label={removeLabel}><X className="size-4" /></button></div>}</div>;
}
