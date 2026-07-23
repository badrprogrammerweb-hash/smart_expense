"use client";

import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { MutationDisabledNotice, useConnectivity } from "@/components/connectivity";
import {
  useCategories,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
} from "@/hooks/use-categories";
import type { CategoryType, MainCategory } from "@/lib/api/categories";
import type { WorkspaceRole } from "@/lib/api/workspaces";
import { getCategoryLabel } from "@/lib/i18n/category-labels";
import { canManageCategories } from "@/lib/permissions";

type CategoryListProps = {
  workspaceId: string;
  role: WorkspaceRole;
  categoryType: CategoryType;
};

type RowItem = { id: string; name: string; translation_key: string | null; is_archived: boolean };

export function CategoryList({ workspaceId, role, categoryType }: CategoryListProps) {
  const t = useTranslations("categories");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const catalogT = useTranslations("categories.catalog");
  const categories = useCategories(workspaceId, { categoryType, includeArchived: true });
  const updateCategory = useUpdateCategory(workspaceId);
  const reorderCategories = useReorderCategories(workspaceId);
  const deleteCategory = useDeleteCategory(workspaceId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const canManage = canManageCategories(role);
  const { canMutate } = useConnectivity();

  const mains = useMemo(
    () => [...(categories.data?.categories ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [categories.data?.categories],
  );

  if (categories.isLoading) {
    return <Skeleton className="h-48 w-full" label={common("loading")} />;
  }

  if (categories.isError) {
    return (
      <ErrorState
        title={errors("requestFailed")}
        description={errors("requestFailed")}
        retry={() => void categories.refetch()}
        retryLabel={common("retry")}
      />
    );
  }

  if (mains.length === 0) {
    return <EmptyState title={categoryType === "expense" ? t("expenseCategories") : t("incomeCategories")} description={common("none")} />;
  }

  function toggleExpanded(id: string) {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function startEditing(item: RowItem) {
    setRowError(null);
    setConfirmingDeleteId(null);
    setEditingId(item.id);
    setNameDraft(item.name);
  }

  async function saveRename(item: RowItem) {
    if (!canMutate) return;
    const trimmed = nameDraft.trim();

    if (!trimmed) {
      setRowError({ id: item.id, message: t("validationName") });
      return;
    }

    try {
      await updateCategory.mutateAsync({ categoryId: item.id, input: { name: trimmed } });
      setRowError(null);
      setEditingId(null);
    } catch (caught) {
      setRowError({ id: item.id, message: caught instanceof Error ? caught.message : errors("requestFailed") });
    }
  }

  async function toggleArchive(item: RowItem) {
    if (!canMutate) return;
    setRowError(null);

    try {
      await updateCategory.mutateAsync({ categoryId: item.id, input: { is_archived: !item.is_archived } });
    } catch (caught) {
      setRowError({ id: item.id, message: caught instanceof Error ? caught.message : errors("requestFailed") });
    }
  }

  async function handleDelete(item: RowItem, hasChildren: boolean) {
    if (!canMutate) return;
    if (hasChildren) {
      return;
    }
    if (confirmingDeleteId !== item.id) {
      setRowError(null);
      setConfirmingDeleteId(item.id);
      return;
    }

    try {
      await deleteCategory.mutateAsync(item.id);
      setRowError(null);
      setConfirmingDeleteId(null);
    } catch (caught) {
      setRowError({ id: item.id, message: caught instanceof Error ? caught.message : errors("requestFailed") });
      setConfirmingDeleteId(null);
    }
  }

  async function moveMain(index: number, direction: -1 | 1) {
    if (!canMutate) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= mains.length) {
      return;
    }
    const reordered = [...mains];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    try {
      await reorderCategories.mutateAsync({ categoryType, categoryIds: reordered.map((item) => item.id) });
    } catch (caught) {
      setRowError({ id: mains[index].id, message: caught instanceof Error ? caught.message : errors("requestFailed") });
    }
  }

  async function moveSub(main: MainCategory, index: number, direction: -1 | 1) {
    if (!canMutate) return;
    const subs = [...main.subcategories].sort((a, b) => a.sort_order - b.sort_order);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= subs.length) {
      return;
    }
    const reordered = [...subs];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    try {
      await reorderCategories.mutateAsync({ parentId: main.id, categoryIds: reordered.map((item) => item.id) });
    } catch (caught) {
      setRowError({ id: subs[index].id, message: caught instanceof Error ? caught.message : errors("requestFailed") });
    }
  }

  function renderRowActions(
    item: RowItem,
    options: {
      hasChildren: boolean;
      canMoveUp: boolean;
      canMoveDown: boolean;
      onMoveUp: () => void;
      onMoveDown: () => void;
    },
  ) {
    if (!canManage) {
      return null;
    }

    const isConfirmingDelete = confirmingDeleteId === item.id;

    return (
      <div className="flex flex-wrap gap-2">
        <button
          aria-label={t("moveUp")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-40"
          disabled={!options.canMoveUp || reorderCategories.isPending || !canMutate}
          onClick={options.onMoveUp}
          type="button"
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          aria-label={t("moveDown")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-40"
          disabled={!options.canMoveDown || reorderCategories.isPending || !canMutate}
          onClick={options.onMoveDown}
          type="button"
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
          disabled={!canMutate}
          onClick={() => startEditing(item)}
          type="button"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {t("rename")}
        </button>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
          disabled={updateCategory.isPending || !canMutate}
          onClick={() => void toggleArchive(item)}
          type="button"
        >
          {item.is_archived ? (
            <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Archive className="h-4 w-4" aria-hidden="true" />
          )}
          {item.is_archived ? t("unarchive") : t("archive")}
        </button>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-40"
          disabled={options.hasChildren || !canMutate}
          onClick={() => void handleDelete(item, options.hasChildren)}
          title={options.hasChildren ? t("deleteBlocked") : undefined}
          type="button"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {isConfirmingDelete ? t("confirmDelete") : t("delete")}
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]">
      <div className="border-b p-5">
        <h2 className="text-lg font-semibold">
          {categoryType === "expense" ? t("expenseCategories") : t("incomeCategories")}
        </h2>
      </div>
      <div className="px-5"><MutationDisabledNotice /></div>
      <ul className="divide-y">
        {mains.map((main, mainIndex) => {
          const isEditing = editingId === main.id;
          const isExpanded = expandedIds.has(main.id);
          const subs = [...main.subcategories].sort((a, b) => a.sort_order - b.sort_order);

          return (
            <li className="p-5" key={main.id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted"
                    onClick={() => toggleExpanded(main.id)}
                    type="button"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        aria-label={t("renameInputLabel")}
                        autoFocus
                        className="h-11 w-full max-w-sm rounded-md border bg-background px-3"
                        onChange={(event) => setNameDraft(event.target.value)}
                        value={nameDraft}
                      />
                      <button
                        className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                        disabled={updateCategory.isPending || !canMutate}
                        onClick={() => void saveRename(main)}
                        type="button"
                      >
                        {common("save")}
                      </button>
                      <button
                        className="h-11 rounded-md border px-4 text-sm font-medium"
                        onClick={() => setEditingId(null)}
                        type="button"
                      >
                        {common("cancel")}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-base font-semibold">{getCategoryLabel(catalogT, main)}</p>
                      {main.is_archived && (
                        <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {t("archived")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {!isEditing &&
                  renderRowActions(main, {
                    hasChildren: subs.length > 0,
                    canMoveUp: mainIndex > 0,
                    canMoveDown: mainIndex < mains.length - 1,
                    onMoveUp: () => void moveMain(mainIndex, -1),
                    onMoveDown: () => void moveMain(mainIndex, 1),
                  })}
              </div>
              {rowError?.id === main.id && <p className="mt-2 text-sm text-destructive">{rowError.message}</p>}

              {isExpanded && (
                <ul className="mt-4 space-y-3 border-l pl-6 rtl:border-l-0 rtl:border-r rtl:pl-0 rtl:pr-6">
                  {subs.length === 0 && <li className="text-sm text-muted-foreground">{common("none")}</li>}
                  {subs.map((sub, subIndex) => {
                    const isSubEditing = editingId === sub.id;

                    return (
                      <li className="flex flex-wrap items-center justify-between gap-4" key={sub.id}>
                        {isSubEditing ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              aria-label={t("renameInputLabel")}
                              autoFocus
                              className="h-11 w-full max-w-sm rounded-md border bg-background px-3"
                              onChange={(event) => setNameDraft(event.target.value)}
                              value={nameDraft}
                            />
                            <button
                              className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                              disabled={updateCategory.isPending || !canMutate}
                              onClick={() => void saveRename(sub)}
                              type="button"
                            >
                              {common("save")}
                            </button>
                            <button
                              className="h-11 rounded-md border px-4 text-sm font-medium"
                              onClick={() => setEditingId(null)}
                              type="button"
                            >
                              {common("cancel")}
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-medium">{getCategoryLabel(catalogT, sub)}</p>
                            {sub.is_archived && (
                              <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {t("archived")}
                              </span>
                            )}
                          </div>
                        )}
                        {!isSubEditing &&
                          renderRowActions(sub, {
                            hasChildren: false,
                            canMoveUp: subIndex > 0,
                            canMoveDown: subIndex < subs.length - 1,
                            onMoveUp: () => void moveSub(main, subIndex, -1),
                            onMoveDown: () => void moveSub(main, subIndex, 1),
                          })}
                        {rowError?.id === sub.id && <p className="w-full text-sm text-destructive">{rowError.message}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
