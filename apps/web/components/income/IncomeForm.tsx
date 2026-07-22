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
import { AmountInput, Button, DateDisplay, FormError, FormField, FormLabel, Input, PermissionDeniedState, Textarea } from "@/components/ui";

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
  const selectedDate = form.watch("occurred_on");

  if (!canManageIncome(role)) {
    return <PermissionDeniedState action={t("addIncome").toLowerCase()} description={t("incomeBlocked")} role={role === "viewer" ? "Viewer" : "Member"} title={common("permissionRequired")} />;
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
    <form className="space-y-4 rounded-[var(--radius-card)] border bg-card p-5 shadow-[var(--shadow-card)]" onSubmit={form.handleSubmit(submit)}>
      <h2 className="text-lg font-semibold">{record ? t("updateIncome") : t("addIncome")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField><FormLabel htmlFor="income-amount">{t("amount")}</FormLabel><AmountInput id="income-amount" className="mt-2" currency={currency} {...form.register("amount")} /></FormField>
        <FormField><FormLabel htmlFor="income-date">{t("date")}</FormLabel><Input id="income-date" className="mt-2" dir="ltr" type="date" {...form.register("occurred_on")} />{selectedDate ? <DateDisplay date={selectedDate} className="mt-1 text-xs text-muted-foreground" /> : null}</FormField>
      </div>
      <FormError>{form.formState.errors.amount?.message}</FormError>
      <FormError>{form.formState.errors.occurred_on?.message}</FormError>
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
      <FormField><FormLabel htmlFor="income-description">{t("description")}</FormLabel><Textarea id="income-description" className="mt-2" {...form.register("description")} /></FormField>
      {formError && <FormError>{formError}</FormError>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          loading={form.formState.isSubmitting || createIncome.isPending || updateIncome.isPending}
        >
          {common("save")}
        </Button>
        {onCancel && (
          <Button variant="secondary" type="button" onClick={onCancel}>
            {common("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
