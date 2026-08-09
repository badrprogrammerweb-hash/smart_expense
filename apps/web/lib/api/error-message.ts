"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { ApiError, isConnectivityError } from "@/lib/api/client";

/**
 * The only bridge between a backend failure and something a user reads.
 *
 * Server and infrastructure error text is written for operators: it is English
 * regardless of the user's locale, and it can name internal hosts, ports,
 * drivers and SQL. None of it may reach the interface. A response is turned
 * into user-facing copy through its structured `error.code` and nothing else —
 * the accompanying `message` is kept on `ApiError` for logging, never rendered.
 *
 * Codes here are the ones the API actually emits (see `apps/api/app/routes/*`
 * and `app/main.py::_default_error`); anything unrecognised, including every
 * unmapped 5xx, falls back to a safe localized message.
 */
const errorKeyByCode: Record<string, string> = {
  // Shared envelope codes.
  unauthenticated: "unauthenticated",
  forbidden: "forbidden",
  not_authorized: "forbidden",
  not_found: "notFoundResource",
  conflict: "conflict",
  invalid_request: "invalidRequest",
  invalid_limit: "invalidRequest",
  rate_limited: "rateLimited",

  // Infrastructure — deliberately generic: these carry operator detail.
  database_unavailable: "serviceUnavailable",
  database_not_configured: "serviceUnavailable",
  workspace_bootstrap_unavailable: "serviceUnavailable",

  // Structured validation the backend intends the client to explain.
  invalid_amount: "invalidAmount",
  invalid_date: "invalidDate",
  invalid_category: "invalidCategory",
  category_archived: "categoryArchived",
  category_type_mismatch: "categoryTypeMismatch",
  duplicate_category_name: "duplicateCategoryName",
  invalid_order: "invalidOrder",
  invalid_parent_category: "invalidParentCategory",
  category_has_references: "categoryHasReferences",
  currency_locked: "currencyLocked",
};

/**
 * Returns a mapper from any thrown value to localized, safe user-facing copy.
 *
 * `fallback` lets a surface keep its own domain wording (e.g. "File upload
 * failed.") for unrecognised failures; it must itself be localized copy.
 */
export function useApiErrorMessage() {
  const t = useTranslations("errors");

  return useCallback(
    (error: unknown, fallback?: string) => {
      if (error instanceof ApiError) {
        const key = errorKeyByCode[error.code];

        if (key) {
          return t(key);
        }
      }

      if (isConnectivityError(error)) {
        return t("network");
      }

      return fallback ?? t("generic");
    },
    [t],
  );
}
