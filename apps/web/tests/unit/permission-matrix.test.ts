import { describe, expect, it } from "vitest";

import { canCreateExpense, canEditOrDeleteExpense, canManageIncome } from "@/lib/permissions";
import type { WorkspaceRole } from "@/lib/api/workspaces";

const roles: WorkspaceRole[] = ["owner", "admin", "member", "viewer"];

describe("permission matrix", () => {
  it("allows income management only for owner and admin", () => {
    expect(Object.fromEntries(roles.map((role) => [role, canManageIncome(role)]))).toEqual({
      owner: true,
      admin: true,
      member: false,
      viewer: false,
    });
  });

  it("allows expense creation for owner, admin, and member only", () => {
    expect(Object.fromEntries(roles.map((role) => [role, canCreateExpense(role)]))).toEqual({
      owner: true,
      admin: true,
      member: true,
      viewer: false,
    });
  });

  it("allows member expense edits only for records they created", () => {
    const ownRecord = { created_by: "user-1" };
    const otherRecord = { created_by: "user-2" };

    expect(canEditOrDeleteExpense(otherRecord, "owner", "user-1")).toBe(true);
    expect(canEditOrDeleteExpense(otherRecord, "admin", "user-1")).toBe(true);
    expect(canEditOrDeleteExpense(ownRecord, "member", "user-1")).toBe(true);
    expect(canEditOrDeleteExpense(otherRecord, "member", "user-1")).toBe(false);
    expect(canEditOrDeleteExpense(ownRecord, "viewer", "user-1")).toBe(false);
  });
});
