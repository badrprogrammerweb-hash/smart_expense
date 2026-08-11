"use client";

import { useId, useMemo } from "react";
import { useTranslations } from "next-intl";

import { useCategories } from "@/hooks/use-categories";
import type { CategoryType, MainCategory } from "@/lib/api/categories";
import { getCategoryLabel } from "@/lib/i18n/category-labels";
import { FormField, FormLabel, Select } from "@/components/ui";

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
  // A record list renders this picker once per open editor — and twice over,
  // because the desktop and mobile lists are both in the DOM. Literal ids made
  // `label[for]` resolve to the first match in the document, so clicking a
  // label inside an inline editor focused the create form instead (BUG-09).
  const fieldId = useId();
  const mainId = `${fieldId}-main`;
  const subId = `${fieldId}-sub`;
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
      <FormField>
        <FormLabel htmlFor={mainId}>{t("category")}</FormLabel>
        <Select
          id={mainId}
          aria-label={t("category")}
          className="mt-2"
          value={selectedMainId}
          onChange={(event) => handleMainChange(event.target.value)}
        >
          <option value="">{common("none")}</option>
          {selectableMainCategories.map((main) => (
            <option value={main.id} key={main.id}>
              {getCategoryLabel(catalogT, main)}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField>
        <FormLabel htmlFor={subId}>{t("subcategory")}</FormLabel>
        <Select
          id={subId}
          aria-label={t("subcategory")}
          className="mt-2"
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
        </Select>
      </FormField>
    </div>
  );
}
