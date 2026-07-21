import { apiFetch } from "./client";

export type CategoryType = "income" | "expense";

export type Subcategory = {
  id: string;
  name: string;
  translation_key: string | null;
  is_system: boolean;
  parent_id: string | null;
  sort_order: number;
  is_archived: boolean;
};

export type MainCategory = Subcategory & {
  subcategories: Subcategory[];
};

/** @deprecated Use `Subcategory`/`MainCategory`. Kept as an alias so
 * pre-Phase-13 consumers of the old flat shape keep compiling. */
export type Category = Subcategory;

export type CategoryInput = {
  name?: string;
  is_archived?: boolean;
};

export async function getCategories(
  workspaceId: string,
  categoryType: CategoryType,
  options: { includeArchived?: boolean } = {},
) {
  const params = new URLSearchParams();
  params.set("category_type", categoryType);

  if (options.includeArchived === false) {
    params.set("include_archived", "false");
  }

  return apiFetch<{ categories: MainCategory[] }>(
    `/workspaces/${workspaceId}/categories?${params.toString()}`,
  );
}

export type CreateCategoryInput = {
  name: string;
  categoryType?: CategoryType;
  parentId?: string;
};

export async function createCategory(workspaceId: string, input: CreateCategoryInput) {
  return apiFetch<Subcategory>(`/workspaces/${workspaceId}/categories`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      category_type: input.categoryType,
      parent_id: input.parentId,
    }),
  });
}

export async function updateCategory(workspaceId: string, categoryId: string, input: CategoryInput) {
  return apiFetch<Subcategory>(`/workspaces/${workspaceId}/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export type ReorderCategoriesInput = {
  categoryType?: CategoryType;
  parentId?: string;
  categoryIds: string[];
};

export async function reorderCategories(workspaceId: string, input: ReorderCategoriesInput) {
  return apiFetch<{ categories: MainCategory[] }>(`/workspaces/${workspaceId}/categories/order`, {
    method: "PUT",
    body: JSON.stringify({
      category_type: input.categoryType,
      parent_id: input.parentId,
      category_ids: input.categoryIds,
    }),
  });
}

export async function deleteCategory(workspaceId: string, categoryId: string) {
  return apiFetch<void>(`/workspaces/${workspaceId}/categories/${categoryId}`, {
    method: "DELETE",
  });
}
