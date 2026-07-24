import { Camera, CameraErrorCode, type TakePhotoOptions } from "@capacitor/camera";

export type CameraCaptureOutcome =
  | { status: "captured"; file: File }
  | { status: "cancelled" }
  | { status: "permission-denied" }
  | { status: "unavailable" }
  | { status: "failed" };

const CAPTURE_OPTIONS: TakePhotoOptions = {
  quality: 90,
  correctOrientation: true,
  // Receipts are financial documents; never leave a second copy in the
  // user's general photo library (contracts/on-device-security.md).
  saveToGallery: false,
};

// Derived from the fetched blob's actual type rather than assumed from
// CAPTURE_OPTIONS, so the file extension can never drift out of sync with
// its real content if the capture encoding ever changes.
function extensionForType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

/**
 * Bridges the native camera into a plain File so the existing upload path
 * (validation, preview, apiFetch) never needs to know a photo came from the
 * device camera rather than the file picker. `takePhoto` is used over the
 * deprecated `getPhoto` — this is a new integration, not legacy code to keep.
 */
export async function captureFromCamera(): Promise<CameraCaptureOutcome> {
  let result;
  try {
    result = await Camera.takePhoto(CAPTURE_OPTIONS);
  } catch (error) {
    const code = (error as { code?: string } | undefined)?.code;
    if (code === CameraErrorCode.TakePhotoCancelled) return { status: "cancelled" };
    if (code === CameraErrorCode.CameraPermissionDenied) return { status: "permission-denied" };
    if (code === CameraErrorCode.NoCameraAvailable) return { status: "unavailable" };
    return { status: "failed" };
  }

  if (!result.webPath) {
    return { status: "failed" };
  }

  try {
    const response = await fetch(result.webPath);
    const blob = await response.blob();
    const type = blob.type || "image/jpeg";
    const file = new File([blob], `capture-${Date.now()}.${extensionForType(type)}`, { type });
    return { status: "captured", file };
  } catch {
    return { status: "failed" };
  }
}
