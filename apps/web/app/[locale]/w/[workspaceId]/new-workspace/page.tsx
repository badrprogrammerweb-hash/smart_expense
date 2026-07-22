"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCreateWorkspace } from "@/hooks/use-workspaces";
import { Button, FormError, FormField, FormLabel, Input } from "@/components/ui";

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
    <form className="mx-auto max-w-md space-y-4 rounded-[var(--radius-card)] border bg-card p-5 shadow-[var(--shadow-card)]" onSubmit={form.handleSubmit(submit)}>
      <h1 className="text-lg font-semibold">{t("createWorkspace")}</h1>
      <FormField><FormLabel htmlFor="workspace-name">{t("workspaceName")}</FormLabel><Input id="workspace-name" className="mt-2" {...form.register("name")} /></FormField>
      <FormError>{form.formState.errors.name?.message}</FormError>
      <FormError>{formError}</FormError>
      <Button
        type="submit"
        loading={form.formState.isSubmitting || createWorkspace.isPending}
      >
        {t("create")}
      </Button>
    </form>
  );
}
