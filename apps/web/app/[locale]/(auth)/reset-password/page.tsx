"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().email(),
});

type ResetValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const locale = useLocale();
  const t = useTranslations("auth");
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<ResetValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function submit(values: ResetValues) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/${locale}/sign-in`,
    });

    setMessage(error?.message ?? t("resetSent"));
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">{t("resetTitle")}</h1>
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
          {message && <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{message}</p>}
          <button
            className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {t("resetAction")}
          </button>
        </form>
        <p className="mt-5 text-sm">
          <Link href={`/${locale}/sign-in`}>{t("signIn")}</Link>
        </p>
      </section>
    </main>
  );
}
