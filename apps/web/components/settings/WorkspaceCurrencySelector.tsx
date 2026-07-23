"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { useUpdateWorkspaceCurrency } from "@/hooks/use-workspaces";
import { MutationDisabledNotice, useConnectivity } from "@/components/connectivity";
import { ApiError } from "@/lib/api/client";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { supportedCurrencies, type SupportedCurrency } from "@/lib/currency";
import { canEditWorkspaceCurrency } from "@/lib/permissions";

type WorkspaceCurrencySelectorProps = {
  currency: SupportedCurrency;
  currencyLocked: boolean;
  role: WorkspaceRole;
  workspaceId: string;
};

export function WorkspaceCurrencySelector({
  currency,
  currencyLocked,
  role,
  workspaceId,
}: WorkspaceCurrencySelectorProps) {
  const t = useTranslations("settings");
  const errors = useTranslations("errors");
  const selectId = useId();
  const descriptionId = `${selectId}-description`;
  const updateCurrency = useUpdateWorkspaceCurrency(workspaceId);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [locked, setLocked] = useState(currencyLocked);
  const [error, setError] = useState<string | null>(null);
  const { canMutate } = useConnectivity();
  const canEdit = canEditWorkspaceCurrency(role);
  const disabled = !canEdit || locked || updateCurrency.isPending || !canMutate;

  useEffect(() => {
    setSelectedCurrency(currency);
  }, [currency]);

  useEffect(() => {
    setLocked(currencyLocked);
  }, [currencyLocked]);

  async function handleChange(nextCurrency: SupportedCurrency) {
    if (!canMutate) return;
    if (nextCurrency === selectedCurrency) {
      return;
    }

    const previousCurrency = selectedCurrency;
    setSelectedCurrency(nextCurrency);
    setError(null);

    try {
      await updateCurrency.mutateAsync(nextCurrency);
    } catch (caught) {
      setSelectedCurrency(previousCurrency);
      if (caught instanceof ApiError && caught.code === "currency_locked") {
        setLocked(true);
        setError(t("currencyLocked"));
        return;
      }
      setError(errors("requestFailed"));
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <label className="text-lg font-semibold" htmlFor={selectId}>
            {t("currency")}
          </label>
          <p className="mt-2 text-sm text-muted-foreground" id={descriptionId}>
            {t("currencyDescription")}
          </p>
        </div>
        <select
          aria-describedby={descriptionId}
          aria-busy={updateCurrency.isPending}
          className="h-10 min-w-36 rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          id={selectId}
          onChange={(event) => void handleChange(event.currentTarget.value as SupportedCurrency)}
          value={selectedCurrency}
        >
          {supportedCurrencies.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      {!canEdit ? <p className="mt-3 text-sm text-muted-foreground">{t("currencyOwnerOnly")}</p> : null}
      {locked ? <p className="mt-3 text-sm text-muted-foreground">{t("currencyLocked")}</p> : null}
      <MutationDisabledNotice />
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
