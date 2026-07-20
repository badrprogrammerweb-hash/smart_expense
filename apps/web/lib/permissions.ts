import type { ExpenseRecord } from "@/lib/api/expenses";
import type { ExtractionRecord } from "@/lib/api/extractions";
import type { WorkspaceRole } from "@/lib/api/workspaces";

export function canManageIncome(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function canManageCategories(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function canCreateExpense(role: WorkspaceRole) {
  return role === "owner" || role === "admin" || role === "member";
}

export function canUploadFile(role: WorkspaceRole) {
  return role === "owner" || role === "admin" || role === "member";
}

export function canDeleteFile(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function canEditAutoDelete(role: WorkspaceRole) {
  return role === "owner";
}

export function canEditWorkspaceCurrency(role: WorkspaceRole) {
  return role === "owner";
}

export function canManageAiSettings(role: WorkspaceRole) {
  return role === "owner";
}

export function canViewHistory(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function canRequestAiSummary(role: WorkspaceRole) {
  return role === "owner" || role === "admin" || role === "member";
}

export function canEditOrDeleteExpense(
  record: Pick<ExpenseRecord, "created_by">,
  role: WorkspaceRole,
  currentUserId: string | null | undefined,
) {
  if (role === "owner" || role === "admin") {
    return true;
  }

  return role === "member" && Boolean(currentUserId) && record.created_by === currentUserId;
}

export function canTriggerExtraction(role: WorkspaceRole) {
  return role === "owner" || role === "admin" || role === "member";
}

export function canActOnExtraction(
  record: Pick<ExtractionRecord, "triggered_by">,
  role: WorkspaceRole,
  currentUserId: string | null | undefined,
) {
  if (role === "owner" || role === "admin") {
    return true;
  }

  return role === "member" && Boolean(currentUserId) && record.triggered_by === currentUserId;
}
