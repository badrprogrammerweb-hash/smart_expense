"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useRouter } from "@/i18n/navigation";
import { isLocale, routing } from "@/i18n/routing";
import { useApiErrorMessage } from "@/lib/api/error-message";
import { updateLocale } from "@/lib/api/me";
import { redirectToPreferredWorkspace, rememberExplicitLocale } from "@/lib/auth-routing";
import { useAuthErrorMessage } from "@/lib/auth/auth-error-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Alert, Button } from "@/components/ui";

const PASSWORD_MIN_LENGTH = 6;

type AuthValues = { email: string; password: string };

export default function SignUpPage() {
  const locale = useLocale();
  // The locale layout validates the URL segment before this page renders, so
  // the fallback is unreachable and only satisfies the narrowing.
  const chosenLocale = isLocale(locale) ? locale : routing.defaultLocale;
  const router = useRouter();
  const t = useTranslations("auth");
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const authErrorMessage = useAuthErrorMessage();
  const apiErrorMessage = useApiErrorMessage();
  // Built inside the component so every rule carries application-owned,
  // localized copy. Zod's defaults are developer diagnostics ("Too small:
  // expected string to have >=6 characters") and must never reach a user.
  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t("validationEmailRequired"))
          .email(t("validationEmail")),
        password: z
          .string()
          .min(1, t("validationPasswordRequired"))
          .min(PASSWORD_MIN_LENGTH, t("validationPasswordLength", { min: PASSWORD_MIN_LENGTH })),
      }),
    [t],
  );
  const form = useForm<AuthValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function submit(values: AuthValues) {
    setFormError(null);
    setFormNotice(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp(values);

    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }

    if (!data.session) {
      setFormNotice(t("confirmEmailSent"));
      return;
    }

    // The profile row is created by a database trigger with the column
    // default, so the language the user actually signed up in is only recorded
    // if it is written here. This must complete before
    // `redirectToPreferredWorkspace`, which reads the stored locale back and
    // would otherwise route an /ar/sign-up straight into the English app.
    try {
      await updateLocale(chosenLocale);
    } catch {
      // The account exists and the session is live; a failed preference write
      // is not worth blocking entry on. `rememberExplicitLocale` below still
      // keeps this session in the language the user chose.
    }

    rememberExplicitLocale(chosenLocale);

    try {
      await redirectToPreferredWorkspace(chosenLocale, router);
    } catch (caught) {
      setFormError(apiErrorMessage(caught));
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <section className="w-full max-w-md rounded-[var(--radius-card)] border bg-card p-6 shadow-[var(--shadow-dialog)]">
        <h1 className="text-2xl font-semibold">{t("signUpTitle")}</h1>
        <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(submit)}>
          <label className="block text-sm font-medium">
            {t("email")}
            <input
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
              type="email"
              autoComplete="email"
              {...form.register("email")}
            />
          </label>
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
          <label className="block text-sm font-medium">
            {t("password")}
            <input
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
            />
          </label>
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          )}
          {formNotice && <Alert variant="info" title={formNotice} />}
          {formError && <Alert variant="error" title={formError} />}
          <Button
            className="w-full"
            type="submit"
            loading={form.formState.isSubmitting}
          >
            {t("signUp")}
          </Button>
        </form>
        <p className="mt-5 text-sm">
          <Link href={`/${locale}/sign-in`}>{t("haveAccount")}</Link>
        </p>
      </section>
    </main>
  );
}
