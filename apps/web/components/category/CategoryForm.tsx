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
import { Button, FormError, FormField, FormLabel, Input, PermissionDeniedState, Select } from "@/components/ui";

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
    return <PermissionDeniedState action={t("addCategory").toLowerCase()} description={t("viewerBlocked")} role={role === "viewer" ? "Viewer" : "Member"} title={common("permissionRequired")} />;
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
    <form className="space-y-4 rounded-[var(--radius-card)] border bg-card p-5 shadow-[var(--shadow-card)]" onSubmit={form.handleSubmit(submit)}>
      <h2 className="text-lg font-semibold">{t("addCategory")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField><FormLabel htmlFor="category-name">{t("categoryName")}</FormLabel><Input id="category-name" className="mt-2" {...form.register("name")} /></FormField>
        <FormField><FormLabel htmlFor="category-parent">{t("parentCategory")}</FormLabel><Select id="category-parent" className="mt-2" {...form.register("parentId")}>
            <option value="">{t("newMainCategory")}</option>
            {(mainCategories.data?.categories ?? [])
              .filter((main) => !main.is_archived)
              .map((main) => (
                <option value={main.id} key={main.id}>
                  {getCategoryLabel(catalogT, main)}
                </option>
              ))}
          </Select></FormField>
      </div>
      <FormError>{form.formState.errors.name?.message}</FormError>
      <FormError>{formError}</FormError>
      <Button
        type="submit"
        loading={form.formState.isSubmitting || createCategory.isPending}
      >
        {common("save")}
      </Button>
    </form>
  );
}
