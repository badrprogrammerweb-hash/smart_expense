"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCategories } from "@/hooks/use-categories";
import { useCreateExpense, useUpdateExpense } from "@/hooks/use-expenses";
import type { ExpenseRecord } from "@/lib/api/expenses";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { minorUnitDigits, type SupportedCurrency } from "@/lib/currency";
import { parseInputToMinor } from "@/lib/money";
import { canCreateExpense } from "@/lib/permissions";

type ExpenseFormProps = {
  workspaceId: string;
  role: WorkspaceRole;
  currency: SupportedCurrency;
  record?: ExpenseRecord;
  canSubmit?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
};

function minorToInput(minor: number, currency: SupportedCurrency) {
  const fractionDigits = minorUnitDigits[currency];
  const minorUnitsPerMajor = 10 ** fractionDigits;
  const whole = Math.floor(minor / minorUnitsPerMajor);
  const fraction = String(minor % minorUnitsPerMajor).padStart(fractionDigits, "0");
  return `${whole}.${fraction}`;
}

export function ExpenseForm({ workspaceId, role, currency, record, canSubmit, onSaved, onCancel }: ExpenseFormProps) {
  const t = useTranslations("records");
  const common = useTranslations("common");
  const [formError, setFormError] = useState<string | null>(null);
  const createExpense = useCreateExpense(workspaceId);
  const updateExpense = useUpdateExpense(workspaceId);
  // Shares its cache entry with ExpenseHistoryList's own `includeArchived: true` fetch
  // (same query key) instead of triggering a second, near-duplicate request. Archived
  // categories are filtered out of the selectable options below, except one already
  // assigned to the record being edited (FR-027: it must keep displaying correctly).
  const categories = useCategories(workspaceId, { includeArchived: true });
  const selectableCategories = useMemo(
    () =>
      (categories.data?.categories ?? []).filter(
        (category) => !category.is_archived || category.id === record?.category_id,
      ),
    [categories.data?.categories, record?.category_id],
  );
  const allowed = canSubmit ?? canCreateExpense(role);
  const schema = useMemo(
    () =>
      z.object({
        amount: z.string().refine((value) => parseInputToMinor(value, currency) > 0, t("validationAmount")),
        occurred_on: z.string().min(1, t("validationDate")),
        merchant_name: z.string().optional(),
        description: z.string().optional(),
        category_id: z.string().optional(),
      }),
    [currency, t],
  );
  type FormValues = z.infer<typeof schema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: record ? minorToInput(record.amount_minor, currency) : "",
      occurred_on: record?.occurred_on ?? new Date().toISOString().slice(0, 10),
      merchant_name: record?.merchant_name ?? "",
      description: record?.description ?? "",
      category_id: record?.category_id ?? "",
    },
  });

  if (!allowed) {
    return <p className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">{t("viewerBlocked")}</p>;
  }

  async function submit(values: FormValues) {
    setFormError(null);
    const input = {
      amount_minor: parseInputToMinor(values.amount, currency),
      occurred_on: values.occurred_on,
      category_id: values.category_id || null,
      merchant_name: values.merchant_name?.trim() || null,
      description: values.description?.trim() || null,
    };

    try {
      if (record) {
        await updateExpense.mutateAsync({ expenseId: record.id, input });
      } else {
        await createExpense.mutateAsync(input);
        form.reset({
          amount: "",
          occurred_on: new Date().toISOString().slice(0, 10),
          merchant_name: "",
          description: "",
          category_id: "",
        });
      }
      onSaved?.();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to save expense.");
    }
  }

  return (
    <form className="space-y-4 rounded-lg border bg-card p-5 shadow-sm" onSubmit={form.handleSubmit(submit)}>
      <h2 className="text-lg font-semibold">{record ? t("updateExpense") : t("addExpense")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("amount")}
          <input className="mt-2 h-10 w-full rounded-md border bg-background px-3" inputMode="decimal" {...form.register("amount")} />
        </label>
        <label className="block text-sm font-medium">
          {t("date")}
          <input className="mt-2 h-10 w-full rounded-md border bg-background px-3" type="date" {...form.register("occurred_on")} />
        </label>
      </div>
      {form.formState.errors.amount && <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>}
      {form.formState.errors.occurred_on && (
        <p className="text-sm text-destructive">{form.formState.errors.occurred_on.message}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("merchant")}
          <input className="mt-2 h-10 w-full rounded-md border bg-background px-3" {...form.register("merchant_name")} />
        </label>
        <label className="block text-sm font-medium">
          {t("category")}
          <select className="mt-2 h-10 w-full rounded-md border bg-background px-3" {...form.register("category_id")}>
            <option value="">{common("none")}</option>
            {selectableCategories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">
        {t("description")}
        <textarea className="mt-2 min-h-24 w-full rounded-md border bg-background px-3 py-2" {...form.register("description")} />
      </label>
      {formError && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          type="submit"
          disabled={form.formState.isSubmitting || createExpense.isPending || updateExpense.isPending}
        >
          {common("save")}
        </button>
        {onCancel && (
          <button className="h-10 rounded-md border px-4 text-sm font-medium" type="button" onClick={onCancel}>
            {common("cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
