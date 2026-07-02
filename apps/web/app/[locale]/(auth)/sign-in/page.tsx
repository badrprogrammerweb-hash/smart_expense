"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { redirectToPreferredWorkspace } from "@/lib/auth-routing";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type AuthValues = z.infer<typeof schema>;

export default function SignInPage() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("auth");
  const errors = useTranslations("errors");
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<AuthValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function submit(values: AuthValues) {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      setFormError(error.message);
      return;
    }

    try {
      await redirectToPreferredWorkspace(locale, router);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : errors("requestFailed"));
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">{t("signInTitle")}</h1>
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
              autoComplete="current-password"
              {...form.register("password")}
            />
          </label>
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          )}
          {formError && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
          <button
            className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {t("signIn")}
          </button>
        </form>
        <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
          <Link href={`/${locale}/sign-up`}>{t("needAccount")}</Link>
          <Link href={`/${locale}/reset-password`}>{t("forgotPassword")}</Link>
        </div>
      </section>
    </main>
  );
}
