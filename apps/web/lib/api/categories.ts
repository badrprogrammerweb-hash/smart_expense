import { apiFetch } from "./client";

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_archived: boolean;
};

export type CategoryInput = {
  name?: string;
  is_archived?: boolean;
};

export async function getCategories(workspaceId: string, options: { includeArchived?: boolean } = {}) {
  const params = new URLSearchParams();

  if (options.includeArchived === false) {
    params.set("include_archived", "false");
  }

  const query = params.toString();
  return apiFetch<{ categories: Category[] }>(`/workspaces/${workspaceId}/categories${query ? `?${query}` : ""}`);
}

export async function createCategory(workspaceId: string, name: string) {
  return apiFetch<Category>(`/workspaces/${workspaceId}/categories`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateCategory(workspaceId: string, categoryId: string, input: CategoryInput) {
  return apiFetch<Category>(`/workspaces/${workspaceId}/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
