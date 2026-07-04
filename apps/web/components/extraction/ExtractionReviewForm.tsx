"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, type FormEvent } from "react";

import { ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/api/categories";
import {
  confirmExtraction,
  type ConfirmExtractionInput,
  type ExtractionRecord,
} from "@/lib/api/extractions";
import { parseInputToMinor } from "@/lib/money";

type ExtractionReviewFormProps = {
  workspaceId: string;
  extraction: ExtractionRecord;
  categories: Category[];
  onConfirmed?: (extraction: ExtractionRecord) => void;
};

function minorToInput(minor: number | null | undefined) {
  if (!minor) {
    return "";
  }
  const whole = Math.floor(minor / 100);
  const fraction = String(minor % 100).padStart(2, "0");
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
  extraction,
  categories,
  onConfirmed,
}: ExtractionReviewFormProps) {
  const t = useTranslations("extraction");
  const common = useTranslations("common");
  const draft = extraction.draft;
  const [amount, setAmount] = useState(minorToInput(draft?.amount_minor));
  const [occurredOn, setOccurredOn] = useState(draft?.occurred_on ?? "");
  const [merchantName, setMerchantName] = useState(draft?.vendor_name ?? "");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeCategories = useMemo(
    () => categories.filter((category) => !category.is_archived),
    [categories],
  );

  if (!draft) {
    return (
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{t("review.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t(`status.${extraction.status}`)}</p>
      </section>
    );
  }

  if (!extraction.can_edit) {
    return (
      <section className="space-y-4 rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{t("review.title")}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("review.amount")}</dt>
            <dd className="font-medium">{minorToInput(draft.amount_minor) || common("none")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("review.date")}</dt>
            <dd className="font-medium">{draft.occurred_on ?? common("none")}</dd>
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
    setFormError(null);

    const amountMinor = parseInputToMinor(amount);
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
    <form className="space-y-4 rounded-lg border bg-card p-5 shadow-sm" onSubmit={submit}>
      <div>
        <h2 className="text-lg font-semibold">{t("review.title")}</h2>
        {draft.extracted_currency && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("review.extractedCurrency")}: {draft.extracted_currency}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("review.amount")}
          <input
            className="mt-2 h-10 w-full rounded-md border bg-background px-3"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("review.date")}
          <input
            className="mt-2 h-10 w-full rounded-md border bg-background px-3"
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("review.vendor")}
          <input
            className="mt-2 h-10 w-full rounded-md border bg-background px-3"
            value={merchantName}
            onChange={(event) => setMerchantName(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("review.category")}
          <select
            className="mt-2 h-10 w-full rounded-md border bg-background px-3"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">{common("none")}</option>
            {activeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("review.suggestedCategory")}
          <input
            className="mt-2 h-10 w-full rounded-md border bg-muted px-3 text-muted-foreground"
            readOnly
            value={draft.suggested_category ?? ""}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("review.description")}
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border bg-background px-3 py-2"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>
      {formError && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
      <button
        className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {t("actions.confirm")}
      </button>
    </form>
  );
}
