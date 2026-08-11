"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

/**
 * Holds the error produced by a submit attempt — a server/API failure rather
 * than a per-field validation message — and retires it once it no longer
 * describes what is on screen.
 *
 * A submit error is a statement about the exact values that were sent. The
 * Categories form kept showing "An active category already uses that name."
 * after the name had been corrected, so the user was told a valid input was a
 * duplicate, and briefly saw that alongside "Enter a category name." — two
 * mutually exclusive claims at once (BUG-08).
 *
 * Clearing is deliberately keyed to the submitted values rather than to
 * keystrokes: the message is dropped only when the current values actually
 * differ from the ones that produced it. Re-submitting identical values keeps
 * the error, and merely focusing or re-typing the same text does not flush a
 * message the user still needs. Field-level validation is untouched.
 *
 * The rule lives here once. `useSubmitError` drives it from a react-hook-form
 * instance; `useValueSubmitError` drives it from a plain controlled value, for
 * surfaces that manage their own state. They are two entry points to the same
 * mechanism, not two mechanisms.
 */
function useRetiringError() {
  const [error, setErrorState] = useState<string | null>(null);
  // The values the current message describes. A ref, not state: it must not
  // trigger a render of its own, and the subscription reads it live.
  const describedValues = useRef<string | null>(null);

  const capture = useCallback((message: string | null, snapshot: string) => {
    describedValues.current = message === null ? null : snapshot;
    setErrorState(message);
  }, []);

  const retireIfChanged = useCallback((snapshot: string) => {
    if (describedValues.current !== null && snapshot !== describedValues.current) {
      describedValues.current = null;
      setErrorState(null);
    }
  }, []);

  return { error, capture, retireIfChanged };
}

/** Submit-error state for a react-hook-form surface. */
export function useSubmitError<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
) {
  const { error, capture, retireIfChanged } = useRetiringError();

  const setError = useCallback(
    (message: string | null) => capture(message, JSON.stringify(form.getValues())),
    [capture, form],
  );

  // Subscribed once for the form's lifetime rather than only while an error is
  // showing: keying the subscription on `error` left a window between setting
  // the message and the effect attaching, in which a fast edit went unnoticed
  // and the stale message survived. The ref is the guard instead — the callback
  // is inert until a message is actually on screen.
  useEffect(() => {
    const subscription = form.watch((values) => retireIfChanged(JSON.stringify(values)));

    return () => subscription.unsubscribe();
  }, [form, retireIfChanged]);

  return { error, setError };
}

/**
 * Submit-error state keyed to a single controlled value — the inline category
 * rename, whose draft is plain component state rather than a form instance.
 * The snapshot is taken when the message is set, so a request that fails after
 * the user has already moved on retires immediately.
 */
export function useValueSubmitError(value: string) {
  const { error, capture, retireIfChanged } = useRetiringError();

  const setError = useCallback(
    (message: string | null) => capture(message, value),
    [capture, value],
  );

  useEffect(() => {
    retireIfChanged(value);
  }, [retireIfChanged, value]);

  return { error, setError };
}
