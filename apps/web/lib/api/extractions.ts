import { apiFetch } from "./client";
import type { AiProvider } from "./ai-settings";

export type ExtractionStatus =
  | "processing"
  | "ready_for_review"
  | "failed"
  | "confirmed"
  | "discarded";

export type FailureReason =
  | "invalid_key"
  | "rate_limited"
  | "timeout"
  | "unreadable_file"
  | "malformed_response"
  | "provider_error";

export type ExtractionDraft = {
  amount_minor: number | null;
  extracted_currency: string | null;
  occurred_on: string | null;
  vendor_name: string | null;
  suggested_category: string | null;
  suggested_category_id: string | null;
};

export type ExtractionRecord = {
  id: string;
  workspace_id: string;
  file_id: string;
  provider: AiProvider;
  status: ExtractionStatus;
  draft: ExtractionDraft | null;
  failure_reason: FailureReason | null;
  triggered_by: string;
  triggered_at: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  discarded_by: string | null;
  discarded_at: string | null;
  expense_id: string | null;
  can_edit: boolean;
  can_discard: boolean;
};

export type ConfirmExtractionInput = {
  amountMinor: number;
  occurredOn: string;
  categoryId?: string | null;
  merchantName?: string | null;
  description?: string | null;
};

export async function triggerExtraction(workspaceId: string, fileId: string) {
  return apiFetch<ExtractionRecord>(`/workspaces/${workspaceId}/files/${fileId}/extractions`, {
    method: "POST",
  });
}

export async function listExtractions(workspaceId: string, status?: ExtractionStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<ExtractionRecord[]>(`/workspaces/${workspaceId}/extractions${query}`);
}

export async function getExtraction(workspaceId: string, extractionId: string) {
  return apiFetch<ExtractionRecord>(`/workspaces/${workspaceId}/extractions/${extractionId}`);
}

export async function confirmExtraction(
  workspaceId: string,
  extractionId: string,
  input: ConfirmExtractionInput,
) {
  return apiFetch<ExtractionRecord>(
    `/workspaces/${workspaceId}/extractions/${extractionId}/confirm`,
    {
      method: "POST",
      body: JSON.stringify({
        amount_minor: input.amountMinor,
        occurred_on: input.occurredOn,
        category_id: input.categoryId ?? null,
        merchant_name: input.merchantName ?? null,
        description: input.description ?? null,
      }),
    },
  );
}

export async function discardExtraction(workspaceId: string, extractionId: string) {
  return apiFetch<ExtractionRecord>(
    `/workspaces/${workspaceId}/extractions/${extractionId}/discard`,
    { method: "POST" },
  );
}
