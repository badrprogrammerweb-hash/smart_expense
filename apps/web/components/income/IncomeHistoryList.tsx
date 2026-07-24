"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { IncomeForm } from "@/components/income/IncomeForm";
import { MutationDisabledNotice, useConnectivity } from "@/components/connectivity";
import { useDeleteIncome, useIncomes } from "@/hooks/use-incomes";
import type { IncomeRecord } from "@/lib/api/incomes";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { toDisplayAmount } from "@/lib/money";
import { canManageIncome } from "@/lib/permissions";
import { Button, DateDisplay, EmptyState as PrimitiveEmptyState, ErrorState as PrimitiveErrorState, MobileRecordCard, Skeleton } from "@/components/ui";

export function IncomeHistoryList({ workspaceId, role }: { workspaceId: string; role: WorkspaceRole }) {
  const locale = useLocale();
  const t = useTranslations("records");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const { canMutate } = useConnectivity();
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
    if (!canMutate) return;
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
    return <Skeleton className="h-48 w-full" label={common("loading")} />;
  }

  if (incomes.isError) {
    return (
      <PrimitiveErrorState
        title={errors("requestFailed")}
        description={errors("requestFailed")}
        retry={() => void incomes.refetch()}
        retryLabel={common("retry")}
        testId="income-error-state"
      />
    );
  }

  if (records.length === 0) {
    return <PrimitiveEmptyState title={t("noIncome")} description={t("noIncome")} />;
  }

  return (
    <section aria-label={t("incomeHistory")} className="rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]">
      <div className="border-b p-5">
        <h2 className="text-lg font-semibold">{t("incomeHistory")}</h2>
      </div>
      <div className="px-5 pt-3"><MutationDisabledNotice /></div>
      <ul className="hidden divide-y md:block">
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
                    <p className="text-sm text-muted-foreground"><DateDisplay date={record.occurred_on} /></p>
                    {record.description && <p className="mt-1 text-sm">{record.description}</p>}
                    {confirmingDeleteId === record.id && deleteError && (
                      <p className="mt-1 text-sm text-destructive">{deleteError}</p>
                    )}
                  </div>
                  {canManageIncome(role) && (
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
                        disabled={!canMutate}
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
          return isEditing ? (
            <IncomeForm key={record.id} workspaceId={workspaceId} role={role} currency={record.currency} record={record} onSaved={() => setEditingId(null)} onCancel={() => setEditingId(null)} />
          ) : (
            <MobileRecordCard
              key={record.id}
              title={toDisplayAmount(record.amount_minor, locale, record.currency)}
              fields={[
                { label: t("date"), value: <DateDisplay date={record.occurred_on} /> },
                { label: t("description"), value: record.description || common("none") },
              ]}
              actions={canManageIncome(role) ? <><Button size="compact" variant="secondary" type="button" onClick={() => setEditingId(record.id)}><Pencil className="h-4 w-4" aria-hidden="true" />{common("edit")}</Button><Button size="compact" variant="destructive" type="button" disabled={!canMutate} onClick={() => void handleDelete(record)}><Trash2 className="h-4 w-4" aria-hidden="true" />{confirmingDeleteId === record.id ? t("confirmDelete") : common("delete")}</Button></> : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
