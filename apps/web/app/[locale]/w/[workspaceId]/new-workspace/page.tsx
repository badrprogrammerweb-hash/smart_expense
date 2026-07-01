"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCreateWorkspace } from "@/hooks/use-workspaces";

export default function NewWorkspacePage() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("workspace");
  const [formError, setFormError] = useState<string | null>(null);
  const createWorkspace = useCreateWorkspace();
  const schema = useMemo(() => z.object({ name: z.string().min(1, t("validationName")) }), [t]);
  type FormValues = z.infer<typeof schema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  async function submit(values: FormValues) {
    setFormError(null);

    try {
      const workspace = await createWorkspace.mutateAsync(values.name.trim());
      router.push(`/${locale}/w/${workspace.id}/dashboard`);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to create workspace.");
    }
  }

  return (
    <form className="mx-auto max-w-md space-y-4 rounded-lg border bg-card p-5 shadow-sm" onSubmit={form.handleSubmit(submit)}>
      <h1 className="text-lg font-semibold">{t("createWorkspace")}</h1>
      <label className="block text-sm font-medium">
        {t("workspaceName")}
        <input className="mt-2 h-10 w-full rounded-md border bg-background px-3" {...form.register("name")} />
      </label>
      {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
      {formError && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
      <button
        className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        type="submit"
        disabled={form.formState.isSubmitting || createWorkspace.isPending}
      >
        {t("create")}
      </button>
    </form>
  );
}
