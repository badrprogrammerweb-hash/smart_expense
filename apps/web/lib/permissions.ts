import type { ExpenseRecord } from "@/lib/api/expenses";
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
