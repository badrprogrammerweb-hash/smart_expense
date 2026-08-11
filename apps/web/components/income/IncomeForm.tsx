"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { CategoryPicker } from "@/components/category/CategoryPicker";
import { MutationDisabledNotice, useConnectivity } from "@/components/connectivity";
import { useCreateIncome, useUpdateIncome } from "@/hooks/use-incomes";
import { useApiErrorMessage } from "@/lib/api/error-message";
import { useSubmitError } from "@/lib/forms/use-submit-error";
import { todayIsoDate } from "@/lib/format/date";
import type { IncomeRecord } from "@/lib/api/incomes";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { minorUnitDigits, type SupportedCurrency } from "@/lib/currency";
import { useAmountField } from "@/lib/forms/use-amount-field";
import { parseInputToMinor } from "@/lib/money";
import { canManageIncome } from "@/lib/permissions";
import { AmountInput, Button, FormError, FormField, FormFooter, FormLabel, Input, PermissionDeniedState, Textarea } from "@/components/ui";

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

  const { canMutate } = useConnectivity();
  const createIncome = useCreateIncome(workspaceId);
  const updateIncome = useUpdateIncome(workspaceId);
  const errorMessage = useApiErrorMessage();
  const amountField = useAmountField(currency);
  // The record list mounts this form once per open editor, in both the
  // desktop and the mobile list, alongside the always-present create form.
  // Literal ids collided three ways and made `label[for]` focus the wrong
  // form (BUG-09), so each instance derives its own.
  const fieldId = useId();
  const amountId = `${fieldId}-amount`;
  const dateId = `${fieldId}-date`;
  const descriptionId = `${fieldId}-description`;
  const schema = useMemo(
    () =>
      z.object({
        amount: amountField.schema,
        occurred_on: z.string().min(1, t("validationDate")),
        description: z.string().optional(),
        category_id: z.string().optional(),
      }),
    [amountField, t],
  );
  type FormValues = z.infer<typeof schema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: record ? minorToInput(record.amount_minor, currency) : "",
      occurred_on: record?.occurred_on ?? todayIsoDate(),
      description: record?.description ?? "",
      category_id: record?.category_id ?? "",
    },
  });
  // Retires a server error once the values it described have changed,
  // instead of leaving it on screen contradicting a corrected field (BUG-08).
  const { error: submitError, setError: setSubmitError } = useSubmitError(form);

  if (!canManageIncome(role)) {
    return <PermissionDeniedState action={t("addIncome").toLowerCase()} description={t("incomeBlocked")} role={role === "viewer" ? "Viewer" : "Member"} title={common("permissionRequired")} />;
  }

  async function submit(values: FormValues) {
    if (!canMutate) return;
    setSubmitError(null);
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
          occurred_on: todayIsoDate(),
          description: "",
          category_id: "",
        });
      }
      onSaved?.();
    } catch (caught) {
      setSubmitError(errorMessage(caught));
    }
  }

  return (
    <form className="space-y-4 rounded-[var(--radius-card)] border bg-card p-5 shadow-[var(--shadow-card)]" onSubmit={form.handleSubmit(submit)}>
      <h2 className="text-lg font-semibold">{record ? t("updateIncome") : t("addIncome")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField><FormLabel htmlFor={amountId}>{t("amount")}</FormLabel><AmountInput id={amountId} className="mt-2" currency={currency} aria-describedby={amountField.hintId} {...form.register("amount")} /><p className="mt-1 text-xs text-muted-foreground" id={amountField.hintId}>{amountField.hint}</p></FormField>
        <FormField><FormLabel htmlFor={dateId}>{t("date")}</FormLabel><Input id={dateId} className="mt-2" dir="ltr" type="date" {...form.register("occurred_on")} /></FormField>
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
      <FormField><FormLabel htmlFor={descriptionId}>{t("description")}</FormLabel><Textarea id={descriptionId} className="mt-2" {...form.register("description")} /></FormField>
      {submitError && <FormError>{submitError}</FormError>}
      <FormFooter>
        <Button
          type="submit"
          disabled={!canMutate}
          loading={form.formState.isSubmitting || createIncome.isPending || updateIncome.isPending}
        >
          {common("save")}
        </Button>
        <MutationDisabledNotice />
        {onCancel && (
          <Button variant="secondary" type="button" onClick={onCancel}>
            {common("cancel")}
          </Button>
        )}
      </FormFooter>
    </form>
  );
}
