"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { deleteFile, type FileMetadata } from "@/lib/api/files";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canDeleteFile } from "@/lib/permissions";

type DeleteFileDialogProps = {
  file: FileMetadata;
  role: WorkspaceRole;
  workspaceId: string;
};

export function DeleteFileDialog({ file, role, workspaceId }: DeleteFileDialogProps) {
  const t = useTranslations("files");
  const common = useTranslations("common");
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canDeleteFile(role)) {
    return null;
  }

  async function onConfirmDelete() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await deleteFile(workspaceId, file.id);
      queryClient.setQueryData<{ files: FileMetadata[] }>(["files", workspaceId], (current) => ({
        files: (current?.files ?? []).filter((record) => record.id !== file.id),
      }));
      await queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
      setIsConfirming(false);
    } catch {
      setError(t("errors.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  }

  if (!isConfirming) {
    return (
      <button
        className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm text-destructive hover:bg-destructive/10"
        type="button"
        onClick={() => setIsConfirming(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {t("actions.delete")}
      </button>
    );
  }

  return (
    <div className="min-w-64 rounded-md border bg-background p-3 shadow-sm" role="dialog">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">{t("actions.confirmDelete")}</p>
          <p className="mt-1 break-words text-xs text-muted-foreground">{file.original_filename}</p>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="h-8 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isDeleting}
          type="button"
          onClick={() => void onConfirmDelete()}
        >
          {common("confirm")}
        </button>
        <button
          className="h-8 rounded-md border px-3 text-xs font-medium"
          disabled={isDeleting}
          type="button"
          onClick={() => setIsConfirming(false)}
        >
          {common("cancel")}
        </button>
      </div>
    </div>
  );
}
