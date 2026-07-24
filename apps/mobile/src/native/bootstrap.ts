import { captureFromCamera } from "./camera.js";
import { initialiseNativeCapabilities } from "./capabilities.js";
import { registerDeepLinkHandler } from "./deep-link.js";
import { secureSession } from "./secure-session.js";

declare global {
  interface Window {
    __SMART_EXPENSE_PENDING_DEEP_LINK__?: string;
    __SMART_EXPENSE_NATIVE__?: {
      secureSession: typeof secureSession;
      captureFromCamera: typeof captureFromCamera;
    };
  }
}

window.__SMART_EXPENSE_NATIVE__ = { secureSession, captureFromCamera };
void Promise.all([initialiseNativeCapabilities(), registerDeepLinkHandler()]);
