import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";

/**
 * Starts native-only affordances. It intentionally owns no business state: the
 * bundled web UI continues to fetch and render all financial data.
 *
 * Safe-area insets need no native bridge here: `viewport-fit=cover` (root
 * layout) plus the Phase 15 `env(safe-area-inset-*)` utilities already work on
 * iOS and current Android WebView. Do not add `@capacitor-community/safe-area`
 * alongside `@capacitor/status-bar` — its docs warn the two conflict.
 */
export async function initialiseNativeCapabilities() {
  await StatusBar.setOverlaysWebView({ overlay: true });
  await StatusBar.setStyle({ style: Style.Light });

  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack && window.history.length > 1) {
      window.history.back();
      return;
    }
    void App.exitApp();
  });

  document.documentElement.classList.add("capacitor-native");
  window.dispatchEvent(new CustomEvent("smart-expense:native-ready"));
}
