"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo } from "react";
import { z } from "zod";

import { minorUnitDigits, type SupportedCurrency } from "@/lib/currency";
import { classifyAmountInput, type AmountValidationReason } from "@/lib/money";

const messageKeyByReason: Record<AmountValidationReason, string> = {
  required: "validationAmountRequired",
  invalid: "validationAmountInvalid",
  not_positive: "validationAmount",
  too_many_decimals: "validationAmountDecimals",
  too_large: "validationAmountTooLarge",
};

/**
 * The copy half of the amount contract: the hint that makes the precision rule
 * discoverable before the first submit, and the message for a given rejection
 * reason. Both are derived from the workspace currency's `minorUnitDigits`, so
 * a 3-decimal currency (KWD/BHD/OMR) says three without anything
 * currency-specific being hardcoded here.
 *
 * Split out from {@link useAmountField} so surfaces that validate by hand can
 * share the same wording without adopting react-hook-form and Zod.
 */
export function useAmountMessages(currency: SupportedCurrency) {
  const t = useTranslations("records");
  // Generated rather than fixed: an inline edit form renders alongside the
  // create form, so a literal id would describe the wrong field.
  const hintId = useId();
  const digits = minorUnitDigits[currency];

  return useMemo(
    () => ({
      hintId,
      hint: t("amountHint", { digits }),
      messageFor: (reason: AmountValidationReason) =>
        t(messageKeyByReason[reason], { currency, digits }),
    }),
    [currency, digits, hintId, t],
  );
}

/**
 * The full amount-field contract for the react-hook-form surfaces (income and
 * expense, create and edit): {@link useAmountMessages} plus a schema fragment
 * that names the rule actually broken rather than collapsing every failure
 * into one message.
 */
export function useAmountField(currency: SupportedCurrency) {
  const messages = useAmountMessages(currency);

  return useMemo(
    () => ({
      ...messages,
      schema: z.string().superRefine((value, ctx) => {
        const reason = classifyAmountInput(value, currency);

        if (!reason) {
          return;
        }

        ctx.addIssue({ code: "custom", message: messages.messageFor(reason) });
      }),
    }),
    [currency, messages],
  );
}
