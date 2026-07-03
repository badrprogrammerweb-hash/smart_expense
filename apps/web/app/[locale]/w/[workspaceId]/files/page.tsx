"use client";

import { useTranslations } from "next-intl";

import { FileList } from "@/components/files/FileList";
import { FileUpload } from "@/components/files/FileUpload";
import { useWorkspaceContext } from "@/lib/workspace-context";

export default function FilesPage() {
  const t = useTranslations("files");
  const { workspaceId, role } = useWorkspaceContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
      </div>
      <FileUpload workspaceId={workspaceId} role={role} />
      <FileList workspaceId={workspaceId} />
    </div>
  );
}
