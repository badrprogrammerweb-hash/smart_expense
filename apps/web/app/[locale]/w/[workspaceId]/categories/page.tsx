"use client";

import { CategoryForm } from "@/components/category/CategoryForm";
import { CategoryList } from "@/components/category/CategoryList";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function CategoriesPage() {
  const { workspaceId, role } = useWorkspaceContext();

  return (
    <div className="space-y-6">
      <CategoryForm workspaceId={workspaceId} role={role} />
      <CategoryList workspaceId={workspaceId} role={role} />
    </div>
  );
}
