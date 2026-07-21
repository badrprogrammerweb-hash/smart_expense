"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { CategoryPicker } from "@/components/category/CategoryPicker";
import { useCreateIncome, useUpdateIncome } from "@/hooks/use-incomes";
import type { IncomeRecord } from "@/lib/api/incomes";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { minorUnitDigits, type SupportedCurrency } from "@/lib/currency";
import { parseInputToMinor } from "@/lib/money";
import { canManageIncome } from "@/lib/permissions";

type IncomeFormProps = {
  workspaceId: string;
  role: WorkspaceRole;
  currency: SupportedCurrency;
  record?: IncomeRecord;
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

export function IncomeForm({ workspaceId, role, currency, record, onSaved, onCancel }: IncomeFormProps) {
  const t = useTranslations("records");
  const common = useTranslations("common");
  const [formError, setFormError] = useState<string | null>(null);
  const createIncome = useCreateIncome(workspaceId);
  const updateIncome = useUpdateIncome(workspaceId);
  const schema = useMemo(
    () =>
      z.object({
        amount: z.string().refine((value) => parseInputToMinor(value, currency) > 0, t("validationAmount")),
        occurred_on: z.string().min(1, t("validationDate")),
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
      description: record?.description ?? "",
      category_id: record?.category_id ?? "",
    },
  });

  if (!canManageIncome(role)) {
    return <p className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">{t("incomeBlocked")}</p>;
  }

  async function submit(values: FormValues) {
    setFormError(null);
    const input = {
      amount_minor: parseInputToMinor(values.amount, currency),
      occurred_on: values.occurred_on,
      description: values.description?.trim() || null,
      category_id: values.category_id || null,
    };

    try {
      if (record) {
        await updateIncome.mutateAsync({ incomeId: record.id, input });
      } else {
        await createIncome.mutateAsync(input);
        form.reset({
          amount: "",
          occurred_on: new Date().toISOString().slice(0, 10),
          description: "",
          category_id: "",
        });
      }
      onSaved?.();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to save income.");
    }
  }

  return (
    <form className="space-y-4 rounded-lg border bg-card p-5 shadow-sm" onSubmit={form.handleSubmit(submit)}>
      <h2 className="text-lg font-semibold">{record ? t("updateIncome") : t("addIncome")}</h2>
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
      <Controller
        control={form.control}
        name="category_id"
        render={({ field }) => (
          <CategoryPicker
            workspaceId={workspaceId}
            categoryType="income"
            value={field.value || null}
            onChange={(categoryId) => field.onChange(categoryId ?? "")}
          />
        )}
      />
      <label className="block text-sm font-medium">
        {t("description")}
        <textarea className="mt-2 min-h-24 w-full rounded-md border bg-background px-3 py-2" {...form.register("description")} />
      </label>
      {formError && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          type="submit"
          disabled={form.formState.isSubmitting || createIncome.isPending || updateIncome.isPending}
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
