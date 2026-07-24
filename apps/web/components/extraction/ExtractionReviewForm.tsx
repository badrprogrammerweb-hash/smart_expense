"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { CategoryPicker } from "@/components/category/CategoryPicker";
import { MutationDisabledNotice, useConnectivity } from "@/components/connectivity";
import { ApiError } from "@/lib/api/client";
import {
  confirmExtraction,
  type ConfirmExtractionInput,
  type ExtractionRecord,
} from "@/lib/api/extractions";
import { minorUnitDigits, type SupportedCurrency } from "@/lib/currency";
import { parseInputToMinor, toDisplayAmount } from "@/lib/money";
import { Alert, Button, DateDisplay, FormField, FormFooter, FormLabel, Input, StatusBadge, Textarea } from "@/components/ui";

type ExtractionReviewFormProps = {
  workspaceId: string;
  currency: SupportedCurrency;
  extraction: ExtractionRecord;
  autoDeleteAfterExtraction?: boolean;
  onConfirmed?: (extraction: ExtractionRecord) => void;
};

function minorToInput(minor: number | null | undefined, currency: SupportedCurrency) {
  if (!minor) {
    return "";
  }
  const fractionDigits = minorUnitDigits[currency];
  const minorUnitsPerMajor = 10 ** fractionDigits;
  const whole = Math.floor(minor / minorUnitsPerMajor);
  const fraction = String(minor % minorUnitsPerMajor).padStart(fractionDigits, "0");
  return `${whole}.${fraction}`;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function ExtractionReviewForm({
  workspaceId,
  currency,
  extraction,
  autoDeleteAfterExtraction = false,
  onConfirmed,
}: ExtractionReviewFormProps) {
  const t = useTranslations("extraction");
  const common = useTranslations("common");
  const locale = useLocale();
  const draft = extraction.draft;
  const [amount, setAmount] = useState(minorToInput(draft?.amount_minor, currency));
  const [occurredOn, setOccurredOn] = useState(draft?.occurred_on ?? "");
  const [merchantName, setMerchantName] = useState(draft?.vendor_name ?? "");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(draft?.suggested_category_id ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { canMutate } = useConnectivity();
  const amountInputId = `extraction-amount-${extraction.id}`;

  if (!draft) {
    return (
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{t("review.title")}</h2>
        <div className="mt-3"><StatusBadge status={extraction.status === "confirmed" ? "confirmed" : extraction.status === "failed" ? "failed" : "neutral"} label={t(`status.${extraction.status}`)} /></div>
      </section>
    );
  }

  if (!extraction.can_edit) {
    return (
      <section className="space-y-4 rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{t("review.title")}</h2>
        <StatusBadge status={extraction.status === "confirmed" ? "confirmed" : extraction.status === "failed" ? "failed" : "neutral"} label={t(`status.${extraction.status}`)} />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("review.amount")}</dt>
            <dd className="font-medium">
              {draft.amount_minor ? toDisplayAmount(draft.amount_minor, locale, currency) : common("none")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("review.date")}</dt>
            <dd className="font-medium">{draft.occurred_on ? <DateDisplay date={draft.occurred_on} /> : common("none")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("review.vendor")}</dt>
            <dd className="font-medium">{draft.vendor_name ?? common("none")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("review.suggestedCategory")}</dt>
            <dd className="font-medium">{draft.suggested_category ?? common("none")}</dd>
          </div>
        </dl>
      </section>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canMutate) return;
    setFormError(null);

    const amountMinor = parseInputToMinor(amount, currency);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0 || !occurredOn) {
      setFormError(t("errors.invalidRequest"));
      return;
    }

    const input: ConfirmExtractionInput = {
      amountMinor,
      occurredOn,
      categoryId: categoryId || null,
      merchantName: merchantName.trim() || null,
      description: description.trim() || null,
    };

    setIsSubmitting(true);
    try {
      const confirmed = await confirmExtraction(workspaceId, extraction.id, input);
      onConfirmed?.(confirmed);
    } catch (error) {
      setFormError(errorMessage(error, t("errors.confirmFailed")));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form data-testid="ai-review-form" className="space-y-4 rounded-[var(--radius-card)] border bg-card p-5 shadow-[var(--shadow-card)]" onSubmit={submit}>
      <div>
        <h2 className="text-lg font-semibold">{t("review.title")}</h2>
        <Alert className="mt-3" variant="info" title={t("review.nonFinalNotice")} />
        {draft.extracted_currency && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("review.extractedCurrency")}: {draft.extracted_currency}
          </p>
        )}
        {autoDeleteAfterExtraction && (
          <p className="mt-2 rounded-md bg-muted p-2 text-sm text-muted-foreground">
            {t("review.autoDeleteNotice")}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField>
          <div className="flex items-center justify-between gap-2">
            <FormLabel htmlFor={amountInputId}>{t("review.amount")}</FormLabel>
            <span className="text-xs text-muted-foreground" aria-hidden="true">
              {currency}
            </span>
          </div>
          <Input
            id={amountInputId}
            className="mt-2 h-11 w-full rounded-md border bg-background px-3"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormField>
        <FormField>
          <FormLabel htmlFor={`extraction-date-${extraction.id}`}>{t("review.date")}</FormLabel>
          <Input
            id={`extraction-date-${extraction.id}`}
            className="mt-2 h-11 w-full rounded-md border bg-background px-3"
            dir="ltr"
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </FormField>
      </div>
      <FormField>
        <FormLabel htmlFor={`extraction-vendor-${extraction.id}`}>{t("review.vendor")}</FormLabel>
        <Input
          id={`extraction-vendor-${extraction.id}`}
          className="mt-2 h-11 w-full rounded-md border bg-background px-3"
          value={merchantName}
          onChange={(event) => setMerchantName(event.target.value)}
        />
      </FormField>
      <CategoryPicker
        workspaceId={workspaceId}
        categoryType="expense"
        value={categoryId || null}
        onChange={(nextCategoryId) => setCategoryId(nextCategoryId ?? "")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField>
          <FormLabel htmlFor={`extraction-suggested-category-${extraction.id}`}>{t("review.suggestedCategory")}</FormLabel>
          <Input
            id={`extraction-suggested-category-${extraction.id}`}
            className="mt-2 h-11 w-full rounded-md border bg-muted px-3 text-muted-foreground"
            readOnly
            value={draft.suggested_category ?? ""}
          />
        </FormField>
        <FormField>
          <FormLabel htmlFor={`extraction-description-${extraction.id}`}>{t("review.description")}</FormLabel>
          <Textarea
            id={`extraction-description-${extraction.id}`}
            className="mt-2 min-h-24 w-full rounded-md border bg-background px-3 py-2"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>
      </div>
      {formError && <Alert variant="error" title={formError} />}
      <FormFooter>
        <Button loading={isSubmitting} disabled={!canMutate} type="submit">
          {t("actions.confirm")}
        </Button>
        <MutationDisabledNotice />
      </FormFooter>
    </form>
  );
}
