"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { MutationDisabledNotice, useConnectivity } from "@/components/connectivity";
import { uploadFile } from "@/lib/api/files";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canUploadFile } from "@/lib/permissions";
import { Alert, Button, PermissionDeniedState } from "@/components/ui";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

type FileUploadProps = {
  workspaceId: string;
  role: WorkspaceRole;
};

function validationError(file: File, t: ReturnType<typeof useTranslations<"files">>) {
  if (file.size === 0) {
    return t("errors.emptyFile");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return t("errors.fileTooLarge");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return t("errors.unsupportedFileType");
  }
  return null;
}

function uploadErrorMessage(error: unknown, t: ReturnType<typeof useTranslations<"files">>) {
  if (error instanceof ApiError) {
    if (error.code === "unsupported_file_type") {
      return t("errors.unsupportedFileType");
    }
    if (error.code === "file_too_large") {
      return t("errors.fileTooLarge");
    }
    if (error.code === "empty_file") {
      return t("errors.emptyFile");
    }
    if (error.code === "forbidden") {
      return t("errors.forbidden");
    }
  }
  return t("errors.uploadFailed");
}

export function FileUpload({ workspaceId, role }: FileUploadProps) {
  const t = useTranslations("files");
  const common = useTranslations("common");
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { canMutate } = useConnectivity();

  if (!canUploadFile(role)) {
    return <PermissionDeniedState action={t("upload.action").toLowerCase()} description={t("errors.forbidden")} role="Viewer" title={common("permissionRequired")} />;
  }

  function onFileChange(file: File | undefined) {
    setSuccess(null);
    setSelectedFile(file ?? null);
    setError(file ? validationError(file, t) : null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || isUploading || !canMutate) {
      return;
    }

    const clientError = validationError(selectedFile, t);
    if (clientError) {
      setError(clientError);
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    try {
      await uploadFile(workspaceId, { file: selectedFile });
      await queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setSuccess(t("upload.success"));
    } catch (uploadError) {
      setError(uploadErrorMessage(uploadError, t));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="space-y-3 rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-card)]" onSubmit={(event) => void onSubmit(event)}>
      <div>
        <label className="text-sm font-medium" htmlFor="file-upload">
          {t("upload.title")}
        </label>
        <p className="mt-1 text-sm text-muted-foreground">{t("upload.hint")}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          id="file-upload"
          className="text-sm"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={(event) => onFileChange(event.target.files?.[0])}
          disabled={!canMutate || isUploading}
        />
        <Button
          type="submit"
          loading={isUploading}
          disabled={!selectedFile || !canMutate}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {t("upload.action")}
        </Button>
      </div>
      <MutationDisabledNotice />
      {error && <Alert variant="error" title={error} />}
      {success && <Alert variant="success" title={success} />}
    </form>
  );
}
