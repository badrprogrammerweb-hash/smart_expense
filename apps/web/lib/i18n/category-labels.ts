import type { useTranslations } from "next-intl";

type CategoryLabelSource = {
  name: string;
  translation_key: string | null;
};

type CatalogTranslator = ReturnType<typeof useTranslations>;

/**
 * Resolves a category/subcategory's display name. System categories carry a
 * `translation_key` (bare slug for a main category, `<main>.<sub>` for a
 * subcategory) that must be looked up under a `t` bound to the
 * `categories.catalog` namespace; subcategory keys live nested one level
 * deeper, under `sub`. User-created categories have no `translation_key` and
 * always render their literal `name` (research.md Decision 4).
 */
export function getCategoryLabel(t: CatalogTranslator, category: CategoryLabelSource): string {
  if (!category.translation_key) {
    return category.name;
  }
  const key = category.translation_key.includes(".")
    ? `sub.${category.translation_key}`
    : category.translation_key;
  return t(key);
}
