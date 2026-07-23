"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Unlink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type { ExpenseRecord } from "@/lib/api/expenses";
import { MutationDisabledNotice, useConnectivity } from "@/components/connectivity";
import {
  detachFileFromExpense,
  linkFileToExpense,
  listFiles,
  type FileMetadata,
} from "@/lib/api/files";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canCreateExpense } from "@/lib/permissions";

type ExpenseFileAttachProps = {
  expense: ExpenseRecord;
  role: WorkspaceRole;
  workspaceId: string;
};

export function ExpenseFileAttach({ expense, role, workspaceId }: ExpenseFileAttachProps) {
  const t = useTranslations("files");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const queryClient = useQueryClient();
  const [selectedFileId, setSelectedFileId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { canMutate } = useConnectivity();
  const canAttach = canCreateExpense(role);
  const files = useQuery({
    queryKey: ["files", workspaceId],
    queryFn: () => listFiles(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const records = files.data?.files ?? [];
  const linkedFiles = useMemo(
    () => records.filter((file) => file.expense_id === expense.id),
    [expense.id, records],
  );
  const attachableFiles = useMemo(
    () => records.filter((file) => file.expense_id === null),
    [records],
  );
  const invalidateLinkedData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["files", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["expenses", workspaceId] }),
    ]);
  };
  const linkMutation = useMutation({
    mutationFn: (fileId: string) => linkFileToExpense(workspaceId, fileId, expense.id),
    onSuccess: async () => {
      setSelectedFileId("");
      setError(null);
      await invalidateLinkedData();
    },
    onError: () => setError(t("errors.linkFailed")),
  });
  const detachMutation = useMutation({
    mutationFn: (fileId: string) => detachFileFromExpense(workspaceId, fileId),
    onSuccess: async () => {
      setError(null);
      await invalidateLinkedData();
    },
    onError: () => setError(t("errors.linkFailed")),
  });
  const isMutating = linkMutation.isPending || detachMutation.isPending;

  function onAttach() {
    if (!selectedFileId || isMutating || !canMutate) {
      return;
    }
    linkMutation.mutate(selectedFileId);
  }

  function filename(file: FileMetadata) {
    return file.original_filename;
  }

  return (
    <div className="mt-4 space-y-3 rounded-md border bg-muted/30 p-3">
      <div>
        <p className="text-sm font-medium">{t("linked.title")}</p>
        {files.isLoading ? (
          <p className="mt-1 text-sm text-muted-foreground">{common("loading")}</p>
        ) : linkedFiles.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {linkedFiles.map((file) => (
              <li className="flex flex-wrap items-center justify-between gap-2 text-sm" key={file.id}>
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="break-words">{filename(file)}</span>
                </span>
                {canAttach && (
                  <button
                    className="inline-flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isMutating || !canMutate}
                    type="button"
                    onClick={() => detachMutation.mutate(file.id)}
                  >
                    <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("actions.detach")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{t("linked.none")}</p>
        )}
      </div>

      {canAttach && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            aria-label={t("linked.choose")}
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
            disabled={files.isLoading || attachableFiles.length === 0 || isMutating || !canMutate}
            value={selectedFileId}
            onChange={(event) => setSelectedFileId(event.target.value)}
          >
            <option value="">{t("linked.choose")}</option>
            {attachableFiles.map((file) => (
              <option value={file.id} key={file.id}>
                {filename(file)}
              </option>
            ))}
          </select>
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedFileId || isMutating || !canMutate}
            type="button"
            onClick={onAttach}
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
            {t("actions.attach")}
          </button>
        </div>
      )}

      {files.isError && <p className="text-sm text-destructive">{errors("requestFailed")}</p>}
      <MutationDisabledNotice />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
