import type { CapacitorConfig } from "@capacitor/cli";

export const mobileDeepLinkScheme = "smartexpense";

const config: CapacitorConfig = {
  appId: "com.smartexpense.ai",
  appName: "Smart Expense AI",
  webDir: "www",
  plugins: {
    App: {
      disableBackButtonHandler: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#FAFAF7",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: "LIGHT",
      backgroundColor: "#006148",
    },
  },
};

export default config;
