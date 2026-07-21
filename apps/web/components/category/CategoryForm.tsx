"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCategories, useCreateCategory } from "@/hooks/use-categories";
import type { CategoryType } from "@/lib/api/categories";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { getCategoryLabel } from "@/lib/i18n/category-labels";
import { canManageCategories } from "@/lib/permissions";

type CategoryFormProps = {
  workspaceId: string;
  role: WorkspaceRole;
  categoryType: CategoryType;
};

export function CategoryForm({ workspaceId, role, categoryType }: CategoryFormProps) {
  const t = useTranslations("categories");
  const common = useTranslations("common");
  const catalogT = useTranslations("categories.catalog");
  const [formError, setFormError] = useState<string | null>(null);
  const createCategory = useCreateCategory(workspaceId);
  const mainCategories = useCategories(workspaceId, { categoryType, includeArchived: false });
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t("validationName")),
        parentId: z.string().optional(),
      }),
    [t],
  );
  type FormValues = z.infer<typeof schema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", parentId: "" },
  });

  if (!canManageCategories(role)) {
    return <p className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">{t("viewerBlocked")}</p>;
  }

  async function submit(values: FormValues) {
    setFormError(null);

    try {
      await createCategory.mutateAsync({
        name: values.name.trim(),
        categoryType: values.parentId ? undefined : categoryType,
        parentId: values.parentId || undefined,
      });
      form.reset({ name: "", parentId: "" });
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to save category.");
    }
  }

  return (
    <form className="space-y-4 rounded-lg border bg-card p-5 shadow-sm" onSubmit={form.handleSubmit(submit)}>
      <h2 className="text-lg font-semibold">{t("addCategory")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("categoryName")}
          <input className="mt-2 h-10 w-full rounded-md border bg-background px-3" {...form.register("name")} />
        </label>
        <label className="block text-sm font-medium">
          {t("parentCategory")}
          <select className="mt-2 h-10 w-full rounded-md border bg-background px-3" {...form.register("parentId")}>
            <option value="">{t("newMainCategory")}</option>
            {(mainCategories.data?.categories ?? [])
              .filter((main) => !main.is_archived)
              .map((main) => (
                <option value={main.id} key={main.id}>
                  {getCategoryLabel(catalogT, main)}
                </option>
              ))}
          </select>
        </label>
      </div>
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
