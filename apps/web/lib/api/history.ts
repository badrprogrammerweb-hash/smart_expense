import { apiFetch } from "./client";

export type ActivityEventType =
  | "income_created"
  | "income_updated"
  | "income_deleted"
  | "expense_created"
  | "expense_updated"
  | "expense_deleted"
  | "category_created"
  | "category_updated"
  | "category_archived"
  | "file_uploaded"
  | "file_deleted"
  | "extraction_started"
  | "extraction_completed"
  | "extraction_failed"
  | "ai_draft_confirmed"
  | "member_added"
  | "member_removed"
  | "role_changed"
  | "setting_changed";

export type ActivityHistoryItem = {
  id: string;
  event_type: ActivityEventType;
  actor_user_id: string | null;
  actor_display_name: string | null;
  entity_table: string;
  entity_id: string | null;
  summary: Record<string, unknown>;
  created_at: string;
};

export type HistoryPage = {
  items: ActivityHistoryItem[];
  next_before: string | null;
};

export async function listHistory(
  workspaceId: string,
  options: { limit?: number; before?: string | null } = {},
) {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 50));
  if (options.before) {
    params.set("before", options.before);
  }

  return apiFetch<HistoryPage>(`/workspaces/${workspaceId}/history?${params.toString()}`);
}
