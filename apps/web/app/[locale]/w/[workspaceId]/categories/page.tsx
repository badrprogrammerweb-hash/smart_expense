"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { CategoryForm } from "@/components/category/CategoryForm";
import { CategoryList } from "@/components/category/CategoryList";
import type { CategoryType } from "@/lib/api/categories";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function CategoriesPage() {
  const { workspaceId, role } = useWorkspaceContext();
  const t = useTranslations("categories");
  const [categoryType, setCategoryType] = useState<CategoryType>("expense");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
      </div>
      <div className="flex gap-2 border-b">
        <button
          className={`h-10 border-b-2 px-4 text-sm font-medium ${
            categoryType === "expense" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
          onClick={() => setCategoryType("expense")}
          type="button"
        >
          {t("expenseCategories")}
        </button>
        <button
          className={`h-10 border-b-2 px-4 text-sm font-medium ${
            categoryType === "income" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
          onClick={() => setCategoryType("income")}
          type="button"
        >
          {t("incomeCategories")}
        </button>
      </div>
      <CategoryForm workspaceId={workspaceId} role={role} categoryType={categoryType} />
      <CategoryList workspaceId={workspaceId} role={role} categoryType={categoryType} />
    </div>
  );
}
