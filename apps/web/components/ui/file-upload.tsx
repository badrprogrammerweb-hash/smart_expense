import { Upload } from "lucide-react";
import { useId, type ChangeEvent, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type FileUploadProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  label: string;
  onFilesSelected?: (files: FileList) => void;
};

export function FileUpload({ label, className, id, onFilesSelected, ...props }: FileUploadProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) onFilesSelected?.(event.target.files);
  }
  return <label htmlFor={inputId} className={cn("flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed border-input px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)] focus-within:shadow-[var(--shadow-focus)]", className)}><Upload aria-hidden="true" className="size-4" />{label}<input id={inputId} className="sr-only" type="file" onChange={handleChange} {...props} /></label>;
}
