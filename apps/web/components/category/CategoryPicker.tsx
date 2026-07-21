"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { useCategories } from "@/hooks/use-categories";
import type { CategoryType, MainCategory } from "@/lib/api/categories";
import { getCategoryLabel } from "@/lib/i18n/category-labels";

type CategoryPickerProps = {
  workspaceId: string;
  categoryType: CategoryType;
  value: string | null;
  onChange: (categoryId: string | null) => void;
};

function findSelectedMain(mainCategories: MainCategory[], value: string | null): MainCategory | undefined {
  if (!value) {
    return undefined;
  }
  return mainCategories.find(
    (main) => main.id === value || main.subcategories.some((sub) => sub.id === value),
  );
}

export function CategoryPicker({ workspaceId, categoryType, value, onChange }: CategoryPickerProps) {
  const t = useTranslations("records");
  const common = useTranslations("common");
  const catalogT = useTranslations("categories.catalog");
  const categories = useCategories(workspaceId, { categoryType, includeArchived: true });
  const mainCategories = categories.data?.categories ?? [];

  const selectedMain = useMemo(() => findSelectedMain(mainCategories, value), [mainCategories, value]);
  const selectedMainId = selectedMain?.id ?? "";
  const selectedSubId = selectedMain && selectedMain.id !== value ? (value ?? "") : "";

  const selectableMainCategories = useMemo(
    () => mainCategories.filter((main) => !main.is_archived || main.id === selectedMainId),
    [mainCategories, selectedMainId],
  );

  const selectableSubcategories = useMemo(
    () =>
      (selectedMain?.subcategories ?? []).filter(
        (sub) => !sub.is_archived || sub.id === selectedSubId,
      ),
    [selectedMain, selectedSubId],
  );

  function handleMainChange(nextMainId: string) {
    onChange(nextMainId || null);
  }

  function handleSubChange(nextSubId: string) {
    onChange(nextSubId || selectedMainId || null);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">
        {t("category")}
        <select
          aria-label={t("category")}
          className="mt-2 h-10 w-full rounded-md border bg-background px-3"
          value={selectedMainId}
          onChange={(event) => handleMainChange(event.target.value)}
        >
          <option value="">{common("none")}</option>
          {selectableMainCategories.map((main) => (
            <option value={main.id} key={main.id}>
              {getCategoryLabel(catalogT, main)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        {t("subcategory")}
        <select
          aria-label={t("subcategory")}
          className="mt-2 h-10 w-full rounded-md border bg-background px-3 disabled:opacity-60"
          value={selectedSubId}
          disabled={!selectedMainId || selectableSubcategories.length === 0}
          onChange={(event) => handleSubChange(event.target.value)}
        >
          <option value="">{t("subcategoryPlaceholder")}</option>
          {selectableSubcategories.map((sub) => (
            <option value={sub.id} key={sub.id}>
              {getCategoryLabel(catalogT, sub)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
