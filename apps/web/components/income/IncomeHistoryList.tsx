"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState } from "@/components/dashboard/DataState";
import { IncomeForm } from "@/components/income/IncomeForm";
import { useDeleteIncome, useIncomes } from "@/hooks/use-incomes";
import type { IncomeRecord } from "@/lib/api/incomes";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { toDisplayAmount } from "@/lib/money";
import { canManageIncome } from "@/lib/permissions";

export function IncomeHistoryList({ workspaceId, role }: { workspaceId: string; role: WorkspaceRole }) {
  const locale = useLocale();
  const t = useTranslations("records");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const incomes = useIncomes(workspaceId);
  const deleteIncome = useDeleteIncome(workspaceId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const records = useMemo(
    () =>
      [...(incomes.data?.incomes ?? [])].sort((a, b) => {
        const dateCompare = b.occurred_on.localeCompare(a.occurred_on);
        return dateCompare || b.created_at.localeCompare(a.created_at);
      }),
    [incomes.data?.incomes],
  );

  async function handleDelete(record: IncomeRecord) {
    if (confirmingDeleteId !== record.id) {
      setDeleteError(null);
      setConfirmingDeleteId(record.id);
      return;
    }

    try {
      await deleteIncome.mutateAsync(record.id);
      setDeleteError(null);
      setConfirmingDeleteId(null);
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : errors("requestFailed"));
    }
  }

  if (incomes.isLoading) {
    return <p className="text-sm text-muted-foreground">{common("loading")}</p>;
  }

  if (incomes.isError) {
    return (
      <ErrorState
        title={errors("requestFailed")}
        action={
          <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => void incomes.refetch()}>
            {common("retry")}
          </button>
        }
      />
    );
  }

  if (records.length === 0) {
    return <EmptyState title={t("noIncome")} />;
  }

  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="border-b p-5">
        <h2 className="text-lg font-semibold">{t("incomeHistory")}</h2>
      </div>
      <ul className="divide-y">
        {records.map((record) => {
          const isEditing = editingId === record.id;

          return (
            <li className="p-5" key={record.id}>
              {isEditing ? (
                <IncomeForm
                  workspaceId={workspaceId}
                  role={role}
                  currency={record.currency}
                  record={record}
                  onSaved={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-primary">
                      {toDisplayAmount(record.amount_minor, locale, record.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">{record.occurred_on}</p>
                    {record.description && <p className="mt-1 text-sm">{record.description}</p>}
                    {confirmingDeleteId === record.id && deleteError && (
                      <p className="mt-1 text-sm text-destructive">{deleteError}</p>
                    )}
                  </div>
                  {canManageIncome(role) && (
                    <div className="flex gap-2">
                      <button
                        className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
                        type="button"
                        onClick={() => setEditingId(record.id)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        {common("edit")}
                      </button>
                      <button
                        className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm text-destructive hover:bg-destructive/10"
                        type="button"
                        onClick={() => void handleDelete(record)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        {confirmingDeleteId === record.id ? t("confirmDelete") : common("delete")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
