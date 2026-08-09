"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useRouter } from "@/i18n/navigation";
import { useApiErrorMessage } from "@/lib/api/error-message";
import { redirectToPreferredWorkspace } from "@/lib/auth-routing";
import { useAuthErrorMessage } from "@/lib/auth/auth-error-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button, FormError, FormField, FormLabel, Input } from "@/components/ui";

const PASSWORD_MIN_LENGTH = 6;

type AuthValues = { email: string; password: string };

export default function SignInPage() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("auth");
  const [formError, setFormError] = useState<string | null>(null);
  // This is the one form where a bare 400 unambiguously means the credentials
  // were rejected, so it opts into that reading.
  const authErrorMessage = useAuthErrorMessage({ credentialFallback: true });
  const apiErrorMessage = useApiErrorMessage();
  // See sign-up: schemas live in the component so their messages are localized
  // application copy rather than Zod's developer-facing defaults.
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
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }

    try {
      await redirectToPreferredWorkspace(locale, router);
    } catch (caught) {
      setFormError(apiErrorMessage(caught));
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <section className="w-full max-w-md rounded-[var(--radius-card)] border bg-card p-6 shadow-[var(--shadow-dialog)]">
        <h1 className="text-2xl font-semibold">{t("signInTitle")}</h1>
        <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(submit)}>
          <FormField><FormLabel htmlFor="sign-in-email">{t("email")}</FormLabel><Input
              id="sign-in-email"
              className="mt-2"
              type="email"
              autoComplete="email"
              {...form.register("email")}
            /></FormField>
          <FormError>{form.formState.errors.email?.message}</FormError>
          <FormField><FormLabel htmlFor="sign-in-password">{t("password")}</FormLabel><Input
              id="sign-in-password"
              className="mt-2"
              type="password"
              autoComplete="current-password"
              {...form.register("password")}
            /></FormField>
          <FormError>{form.formState.errors.password?.message}</FormError>
          <FormError>{formError}</FormError>
          <Button
            className="w-full"
            type="submit"
            loading={form.formState.isSubmitting}
          >
            {t("signIn")}
          </Button>
        </form>
        <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
          <Link href={`/${locale}/sign-up`}>{t("needAccount")}</Link>
          <Link href={`/${locale}/reset-password`}>{t("forgotPassword")}</Link>
        </div>
      </section>
    </main>
  );
}
