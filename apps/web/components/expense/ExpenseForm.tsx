"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { CategoryPicker } from "@/components/category/CategoryPicker";
import { useCreateExpense, useUpdateExpense } from "@/hooks/use-expenses";
import type { ExpenseRecord } from "@/lib/api/expenses";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { minorUnitDigits, type SupportedCurrency } from "@/lib/currency";
import { parseInputToMinor } from "@/lib/money";
import { canCreateExpense } from "@/lib/permissions";
import { AmountInput, Button, DateDisplay, FormError, FormField, FormLabel, Input, PermissionDeniedState, Textarea } from "@/components/ui";

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
  const selectedDate = form.watch("occurred_on");

  if (!allowed) {
    return <PermissionDeniedState action={t("addExpense").toLowerCase()} description={t("viewerBlocked")} role={role === "viewer" ? "Viewer" : "Member"} title={common("permissionRequired")} />;
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
    <form className="space-y-4 rounded-[var(--radius-card)] border bg-card p-5 shadow-[var(--shadow-card)]" onSubmit={form.handleSubmit(submit)}>
      <h2 className="text-lg font-semibold">{record ? t("updateExpense") : t("addExpense")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField><FormLabel htmlFor="expense-amount">{t("amount")}</FormLabel><AmountInput id="expense-amount" className="mt-2" currency={currency} {...form.register("amount")} /></FormField>
        <FormField><FormLabel htmlFor="expense-date">{t("date")}</FormLabel><Input id="expense-date" className="mt-2" dir="ltr" type="date" {...form.register("occurred_on")} />{selectedDate ? <DateDisplay date={selectedDate} className="mt-1 text-xs text-muted-foreground" /> : null}</FormField>
      </div>
      <FormError>{form.formState.errors.amount?.message}</FormError>
      <FormError>{form.formState.errors.occurred_on?.message}</FormError>
      <FormField><FormLabel htmlFor="expense-merchant">{t("merchant")}</FormLabel><Input id="expense-merchant" className="mt-2" {...form.register("merchant_name")} /></FormField>
      <Controller
        control={form.control}
        name="category_id"
        render={({ field }) => (
          <CategoryPicker
            workspaceId={workspaceId}
            categoryType="expense"
            value={field.value || null}
            onChange={(categoryId) => field.onChange(categoryId ?? "")}
          />
        )}
      />
      <FormField><FormLabel htmlFor="expense-description">{t("description")}</FormLabel><Textarea id="expense-description" className="mt-2" {...form.register("description")} /></FormField>
      {formError && <FormError>{formError}</FormError>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          loading={form.formState.isSubmitting || createExpense.isPending || updateExpense.isPending}
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
