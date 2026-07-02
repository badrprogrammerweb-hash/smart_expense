import { apiFetch } from "./client";

export type FileContentType = "image/png" | "image/jpeg" | "image/webp" | "application/pdf";
export type FileStatus = "active" | "deleted";

export type FileMetadata = {
  id: string;
  original_filename: string;
  content_type: FileContentType;
  size_bytes: number;
  expense_id: string | null;
  uploaded_by: string;
  status: FileStatus;
  created_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type SignedUrlResponse = {
  url: string;
  expires_in: number;
};

export type UploadFileInput = {
  file: File;
  expenseId?: string | null;
};

export async function uploadFile(workspaceId: string, input: UploadFileInput) {
  const formData = new FormData();
  formData.append("file", input.file);
  if (input.expenseId) {
    formData.append("expense_id", input.expenseId);
  }

  return apiFetch<FileMetadata>(`/workspaces/${workspaceId}/files`, {
    method: "POST",
    body: formData,
  });
}

export async function listFiles(workspaceId: string) {
  return apiFetch<{ files: FileMetadata[] }>(`/workspaces/${workspaceId}/files`);
}

export async function getFile(workspaceId: string, fileId: string) {
  return apiFetch<FileMetadata>(`/workspaces/${workspaceId}/files/${fileId}`);
}

export async function getFileDownloadUrl(workspaceId: string, fileId: string) {
  return apiFetch<SignedUrlResponse>(`/workspaces/${workspaceId}/files/${fileId}/download-url`);
}

export async function linkFileToExpense(workspaceId: string, fileId: string, expenseId: string) {
  return apiFetch<FileMetadata>(`/workspaces/${workspaceId}/files/${fileId}/link`, {
    method: "POST",
    body: JSON.stringify({ expense_id: expenseId }),
  });
}

export async function detachFileFromExpense(workspaceId: string, fileId: string) {
  return apiFetch<FileMetadata>(`/workspaces/${workspaceId}/files/${fileId}/link`, {
    method: "DELETE",
  });
}

export async function deleteFile(workspaceId: string, fileId: string) {
  return apiFetch<{ id: string; status: "deleted"; deleted_at: string }>(
    `/workspaces/${workspaceId}/files/${fileId}`,
    { method: "DELETE" },
  );
}
