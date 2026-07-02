"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCreateCategory } from "@/hooks/use-categories";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canManageCategories } from "@/lib/permissions";

type CategoryFormProps = {
  workspaceId: string;
  role: WorkspaceRole;
};

export function CategoryForm({ workspaceId, role }: CategoryFormProps) {
  const t = useTranslations("categories");
  const common = useTranslations("common");
  const [formError, setFormError] = useState<string | null>(null);
  const createCategory = useCreateCategory(workspaceId);
  const schema = useMemo(() => z.object({ name: z.string().min(1, t("validationName")) }), [t]);
  type FormValues = z.infer<typeof schema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  if (!canManageCategories(role)) {
    return <p className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">{t("viewerBlocked")}</p>;
  }

  async function submit(values: FormValues) {
    setFormError(null);

    try {
      await createCategory.mutateAsync(values.name.trim());
      form.reset({ name: "" });
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to save category.");
    }
  }

  return (
    <form className="space-y-4 rounded-lg border bg-card p-5 shadow-sm" onSubmit={form.handleSubmit(submit)}>
      <h2 className="text-lg font-semibold">{t("addCategory")}</h2>
      <label className="block text-sm font-medium">
        {t("categoryName")}
        <input className="mt-2 h-10 w-full max-w-sm rounded-md border bg-background px-3" {...form.register("name")} />
      </label>
      {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
      {formError && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
      <button
        className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        type="submit"
        disabled={form.formState.isSubmitting || createCategory.isPending}
      >
        {common("save")}
      </button>
    </form>
  );
}
