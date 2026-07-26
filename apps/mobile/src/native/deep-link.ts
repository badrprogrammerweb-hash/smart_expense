import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

function notifyWebRouter(event: URLOpenListenerEvent) {
  window.__SMART_EXPENSE_PENDING_DEEP_LINK__ = event.url;
  window.dispatchEvent(new CustomEvent("smart-expense:app-url-open", { detail: { url: event.url } }));
}

/** Routes OAuth/app-link returns into the bundled web router without creating a second auth session. */
export async function registerDeepLinkHandler() {
  const launchUrl = await App.getLaunchUrl();
  if (launchUrl) notifyWebRouter(launchUrl);

  await App.addListener("appUrlOpen", async (event) => {
    await Browser.close().catch(() => undefined);
    notifyWebRouter(event);
  });
}
