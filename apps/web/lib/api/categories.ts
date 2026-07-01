import { apiFetch } from "./client";

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_archived: boolean;
};

export async function getCategories(workspaceId: string, options: { includeArchived?: boolean } = {}) {
  const params = new URLSearchParams();

  if (options.includeArchived === false) {
    params.set("include_archived", "false");
  }

  const query = params.toString();
  return apiFetch<{ categories: Category[] }>(`/workspaces/${workspaceId}/categories${query ? `?${query}` : ""}`);
}
