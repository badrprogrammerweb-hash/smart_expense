import { captureFromCamera } from "./camera.js";
import { supportBilling } from "./billing.js";
import { initialiseNativeCapabilities } from "./capabilities.js";
import { registerDeepLinkHandler } from "./deep-link.js";
import { secureSession } from "./secure-session.js";

declare global {
  interface Window {
    __SMART_EXPENSE_PENDING_DEEP_LINK__?: string;
    __SMART_EXPENSE_NATIVE__?: {
      secureSession: typeof secureSession;
      captureFromCamera: typeof captureFromCamera;
      supportBilling: typeof supportBilling;
    };
  }
}

window.__SMART_EXPENSE_NATIVE__ = {
  secureSession,
  captureFromCamera,
  supportBilling,
};
void Promise.all([initialiseNativeCapabilities(), registerDeepLinkHandler()]);
