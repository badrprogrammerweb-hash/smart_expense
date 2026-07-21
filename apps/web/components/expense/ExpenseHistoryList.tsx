"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState } from "@/components/dashboard/DataState";
import { ExpenseFileAttach } from "@/components/expense/ExpenseFileAttach";
import { ExpenseForm } from "@/components/expense/ExpenseForm";
import { useCategories } from "@/hooks/use-categories";
import { useDeleteExpense, useExpenses } from "@/hooks/use-expenses";
import type { ExpenseRecord } from "@/lib/api/expenses";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { getCategoryLabel } from "@/lib/i18n/category-labels";
import { toDisplayAmount } from "@/lib/money";
import { canEditOrDeleteExpense } from "@/lib/permissions";
import { useWorkspaceContext } from "@/lib/workspace-context";

export function ExpenseHistoryList({ workspaceId, role }: { workspaceId: string; role: WorkspaceRole }) {
  const locale = useLocale();
  const t = useTranslations("records");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const catalogT = useTranslations("categories.catalog");
  const { currentUserId } = useWorkspaceContext();
  const expenses = useExpenses(workspaceId);
  const categories = useCategories(workspaceId, { includeArchived: true });
  const deleteExpense = useDeleteExpense(workspaceId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    categories.data?.categories.forEach((category) => {
      map.set(category.id, getCategoryLabel(catalogT, category));
      category.subcategories.forEach((subcategory) =>
        map.set(subcategory.id, getCategoryLabel(catalogT, subcategory)),
      );
    });
    return map;
  }, [categories.data?.categories, catalogT]);
  const records = useMemo(
    () =>
      [...(expenses.data?.expenses ?? [])].sort((a, b) => {
        const dateCompare = b.occurred_on.localeCompare(a.occurred_on);
        return dateCompare || b.created_at.localeCompare(a.created_at);
      }),
    [expenses.data?.expenses],
  );

  async function handleDelete(record: ExpenseRecord) {
    if (confirmingDeleteId !== record.id) {
      setDeleteError(null);
      setConfirmingDeleteId(record.id);
      return;
    }

    try {
      await deleteExpense.mutateAsync(record.id);
      setDeleteError(null);
      setConfirmingDeleteId(null);
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : errors("requestFailed"));
    }
  }

  if (expenses.isLoading) {
    return <p className="text-sm text-muted-foreground">{common("loading")}</p>;
  }

  if (expenses.isError) {
    return (
      <ErrorState
        title={errors("requestFailed")}
        action={
          <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => void expenses.refetch()}>
            {common("retry")}
          </button>
        }
      />
    );
  }

  if (records.length === 0) {
    return <EmptyState title={t("noExpenses")} />;
  }

  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="border-b p-5">
        <h2 className="text-lg font-semibold">{t("expenseHistory")}</h2>
      </div>
      <ul className="divide-y">
        {records.map((record) => {
          const isEditing = editingId === record.id;
          const canManageRecord = canEditOrDeleteExpense(record, role, currentUserId);

          return (
            <li className="border-l-4 border-l-destructive/60 p-5 rtl:border-l-0 rtl:border-r-4 rtl:border-r-destructive/60" key={record.id}>
              {isEditing ? (
                <ExpenseForm
                  workspaceId={workspaceId}
                  role={role}
                  currency={record.currency}
                  record={record}
                  canSubmit={canManageRecord}
                  onSaved={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-destructive">
                      {toDisplayAmount(record.amount_minor, locale, record.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">{record.occurred_on}</p>
                    <p className="mt-1 text-sm">
                      {record.description || record.merchant_name || categoryNames.get(record.category_id ?? "") || common("none")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {record.category_id ? categoryNames.get(record.category_id) ?? common("none") : common("none")}
                    </p>
                    {confirmingDeleteId === record.id && deleteError && (
                      <p className="mt-1 text-sm text-destructive">{deleteError}</p>
                    )}
                    <ExpenseFileAttach expense={record} role={role} workspaceId={workspaceId} />
                  </div>
                  {canManageRecord && (
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
