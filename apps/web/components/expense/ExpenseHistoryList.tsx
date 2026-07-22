"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

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
import { Button, DateDisplay, EmptyState, ErrorState, MobileRecordCard, Skeleton } from "@/components/ui";

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
    return <Skeleton className="h-48 w-full" label={common("loading")} />;
  }

  if (expenses.isError) {
    return (
      <ErrorState
        title={errors("requestFailed")}
        description={errors("requestFailed")}
        retry={() => void expenses.refetch()}
        retryLabel={common("retry")}
      />
    );
  }

  if (records.length === 0) {
    return <EmptyState title={t("noExpenses")} description={t("noExpenses")} />;
  }

  return (
    <section className="rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]">
      <div className="border-b p-5">
        <h2 className="text-lg font-semibold">{t("expenseHistory")}</h2>
      </div>
      <ul className="hidden divide-y md:block">
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
                    <p className="text-sm text-muted-foreground"><DateDisplay date={record.occurred_on} /></p>
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
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => setEditingId(record.id)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        {common("edit")}
                      </Button>
                      <Button
                        variant="destructive"
                        type="button"
                        onClick={() => void handleDelete(record)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        {confirmingDeleteId === record.id ? t("confirmDelete") : common("delete")}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="grid gap-3 p-4 md:hidden">
        {records.map((record) => {
          const isEditing = editingId === record.id;
          const canManageRecord = canEditOrDeleteExpense(record, role, currentUserId);
          const description = record.description || record.merchant_name || categoryNames.get(record.category_id ?? "") || common("none");
          return isEditing ? (
            <ExpenseForm key={record.id} workspaceId={workspaceId} role={role} currency={record.currency} record={record} canSubmit={canManageRecord} onSaved={() => setEditingId(null)} onCancel={() => setEditingId(null)} />
          ) : (
            <MobileRecordCard
              key={record.id}
              title={toDisplayAmount(record.amount_minor, locale, record.currency)}
              fields={[
                { label: t("date"), value: <DateDisplay date={record.occurred_on} /> },
                { label: t("description"), value: description },
                { label: t("category"), value: record.category_id ? categoryNames.get(record.category_id) ?? common("none") : common("none") },
              ]}
              actions={canManageRecord ? <><Button size="compact" variant="secondary" type="button" onClick={() => setEditingId(record.id)}><Pencil className="h-4 w-4" aria-hidden="true" />{common("edit")}</Button><Button size="compact" variant="destructive" type="button" onClick={() => void handleDelete(record)}><Trash2 className="h-4 w-4" aria-hidden="true" />{confirmingDeleteId === record.id ? t("confirmDelete") : common("delete")}</Button></> : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
