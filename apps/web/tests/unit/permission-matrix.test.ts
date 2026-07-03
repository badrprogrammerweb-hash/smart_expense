import { describe, expect, it } from "vitest";

import {
  canCreateExpense,
  canDeleteFile,
  canEditAutoDelete,
  canEditOrDeleteExpense,
  canManageIncome,
  canUploadFile,
} from "@/lib/permissions";
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

  it("allows file upload for owner, admin, and member only", () => {
    expect(Object.fromEntries(roles.map((role) => [role, canUploadFile(role)]))).toEqual({
      owner: true,
      admin: true,
      member: true,
      viewer: false,
    });
  });

  it("allows file deletion for owner and admin only", () => {
    expect(Object.fromEntries(roles.map((role) => [role, canDeleteFile(role)]))).toEqual({
      owner: true,
      admin: true,
      member: false,
      viewer: false,
    });
  });

  it("allows auto-delete setting edits for owner only", () => {
    expect(Object.fromEntries(roles.map((role) => [role, canEditAutoDelete(role)]))).toEqual({
      owner: true,
      admin: false,
      member: false,
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
