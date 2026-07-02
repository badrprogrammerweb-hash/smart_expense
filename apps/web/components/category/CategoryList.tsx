"use client";

import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { ErrorState } from "@/components/dashboard/DataState";
import { useCategories, useUpdateCategory } from "@/hooks/use-categories";
import type { Category } from "@/lib/api/categories";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { canManageCategories } from "@/lib/permissions";

type CategoryListProps = {
  workspaceId: string;
  role: WorkspaceRole;
};

export function CategoryList({ workspaceId, role }: CategoryListProps) {
  const t = useTranslations("categories");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const categories = useCategories(workspaceId, { includeArchived: true });
  const updateCategory = useUpdateCategory(workspaceId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const canManage = canManageCategories(role);
  const items = useMemo(
    () => [...(categories.data?.categories ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [categories.data?.categories],
  );

  if (categories.isLoading) {
    return <p className="text-sm text-muted-foreground">{common("loading")}</p>;
  }

  if (categories.isError) {
    return (
      <ErrorState
        title={errors("requestFailed")}
        action={
          <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => void categories.refetch()}>
            {common("retry")}
          </button>
        }
      />
    );
  }

  function startEditing(category: Category) {
    setRowError(null);
    setEditingId(category.id);
    setNameDraft(category.name);
  }

  async function saveRename(category: Category) {
    const trimmed = nameDraft.trim();

    if (!trimmed) {
      setRowError({ id: category.id, message: t("validationName") });
      return;
    }

    try {
      await updateCategory.mutateAsync({ categoryId: category.id, input: { name: trimmed } });
      setRowError(null);
      setEditingId(null);
    } catch (caught) {
      setRowError({ id: category.id, message: caught instanceof Error ? caught.message : errors("requestFailed") });
    }
  }

  async function toggleArchive(category: Category) {
    setRowError(null);

    try {
      await updateCategory.mutateAsync({ categoryId: category.id, input: { is_archived: !category.is_archived } });
    } catch (caught) {
      setRowError({ id: category.id, message: caught instanceof Error ? caught.message : errors("requestFailed") });
    }
  }

  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="border-b p-5">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </div>
      <ul className="divide-y">
        {items.map((category) => {
          const isEditing = editingId === category.id;

          return (
            <li className="flex flex-wrap items-center justify-between gap-4 p-5" key={category.id}>
              {isEditing ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    autoFocus
                    className="h-10 w-full max-w-sm rounded-md border bg-background px-3"
                    onChange={(event) => setNameDraft(event.target.value)}
                    value={nameDraft}
                  />
                  <button
                    className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                    disabled={updateCategory.isPending}
                    onClick={() => void saveRename(category)}
                    type="button"
                  >
                    {common("save")}
                  </button>
                  <button
                    className="h-10 rounded-md border px-4 text-sm font-medium"
                    onClick={() => setEditingId(null)}
                    type="button"
                  >
                    {common("cancel")}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-base font-semibold">{category.name}</p>
                  {category.is_archived && (
                    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t("archived")}
                    </span>
                  )}
                </div>
              )}
              {rowError?.id === category.id && <p className="w-full text-sm text-destructive">{rowError.message}</p>}
              {canManage && !isEditing && (
                <div className="flex gap-2">
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
                    onClick={() => startEditing(category)}
                    type="button"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    {t("rename")}
                  </button>
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
                    disabled={updateCategory.isPending}
                    onClick={() => void toggleArchive(category)}
                    type="button"
                  >
                    {category.is_archived ? (
                      <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Archive className="h-4 w-4" aria-hidden="true" />
                    )}
                    {category.is_archived ? t("unarchive") : t("archive")}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
