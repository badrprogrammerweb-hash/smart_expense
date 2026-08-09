import type { useTranslations } from "next-intl";

import type { MainCategory } from "@/lib/api/categories";

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

/**
 * Some surfaces only ever see a category's stored `name` — activity history
 * records the name into its `summary` JSON at write time and keeps neither the
 * id nor the `translation_key` (see the history trigger in
 * `20260722000000_hierarchical_categories.sql`). Resolving by name against the
 * workspace's own catalog localizes those rows, including ones written before
 * this fix, without a migration or a backfill.
 *
 * A name is only translatable when it belongs to a system category *and* no
 * user-created category claims the same name: a category the user typed
 * themselves keeps its literal text in every language (research.md Decision 4).
 */
export function buildSystemCategoryKeysByName(trees: Array<MainCategory[] | undefined>) {
  const systemKeyByName = new Map<string, string>();
  const userDefinedNames = new Set<string>();

  const record = (category: CategoryLabelSource) => {
    if (category.translation_key) {
      systemKeyByName.set(category.name, category.translation_key);
    } else {
      userDefinedNames.add(category.name);
    }
  };

  trees.forEach((tree) =>
    tree?.forEach((main) => {
      record(main);
      main.subcategories.forEach(record);
    }),
  );

  userDefinedNames.forEach((name) => systemKeyByName.delete(name));

  return systemKeyByName;
}

/** Localizes a bare category name via {@link buildSystemCategoryKeysByName};
 * returns the name unchanged when it is not a system category's. */
export function getCategoryLabelByName(
  t: CatalogTranslator,
  systemKeyByName: Map<string, string>,
  name: string,
): string {
  const translationKey = systemKeyByName.get(name);

  return translationKey ? getCategoryLabel(t, { name, translation_key: translationKey }) : name;
}
