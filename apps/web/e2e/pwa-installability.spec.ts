import { expect, test } from "@playwright/test";

import { createSeededUser, hasE2eEnvironment, signIn } from "./_helpers/matrix";

const expectedIcons = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any", dimension: 192 },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any", dimension: 512 },
  { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable", dimension: 512 },
] as const;

test.describe("PWA installability", () => {
  test("serves the required manifest, icons, and accessible metadata", async ({ page, request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    const manifest = (await response.json()) as Record<string, unknown> & { icons: Array<Record<string, string>> };

    expect(manifest).toMatchObject({
      id: "/",
      name: "Smart Expense - AI",
      short_name: "Smart Expense",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#fdfcf7",
      theme_color: "#006148",
      dir: "ltr",
      lang: "en",
    });
    expect(typeof manifest.description).toBe("string");
    expect(manifest.description).not.toHaveLength(0);
    expect(manifest.icons).toEqual(
      expectedIcons.map(({ dimension: _dimension, ...icon }) => icon),
    );
    expect(manifest).not.toHaveProperty("related_applications");
    expect(manifest).not.toHaveProperty("prefer_related_applications");
    expect(manifest).not.toHaveProperty("share_target");
    expect(manifest).not.toHaveProperty("protocol_handlers");
    expect(manifest).not.toHaveProperty("display_override");

    await page.goto("/en/sign-in");
    for (const icon of expectedIcons) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.status()).toBe(200);
      expect(iconResponse.headers()["content-type"]).toContain("image/png");
      const dimensions = await page.evaluate(
        ({ src }) =>
          new Promise<{ width: number; height: number }>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => reject(new Error(`Unable to load ${src}`));
            image.src = src;
          }),
        icon,
      );
      expect(dimensions).toEqual({ width: icon.dimension, height: icon.dimension });
    }
    expect(manifest.icons.filter((icon) => icon.purpose === "maskable")).toHaveLength(1);

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#006148");

    // The Apple touch icon is not part of the manifest icon list, so it needs its
    // own check: it is the only source of the iOS home-screen icon and branded
    // launch appearance (FR-003), and a broken path would otherwise ship silently.
    const appleIconHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
    expect(appleIconHref).toBe("/icons/apple-touch-icon.png");
    const appleIconResponse = await request.get(appleIconHref!);
    expect(appleIconResponse.status()).toBe(200);
    expect(appleIconResponse.headers()["content-type"]).toContain("image/png");
    const appleIconDimensions = await page.evaluate(
      (src) =>
        new Promise<{ width: number; height: number }>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => reject(new Error(`Unable to load ${src}`));
          image.src = src;
        }),
      appleIconHref!,
    );
    expect(appleIconDimensions).toEqual({ width: 180, height: 180 });

    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("viewport-fit=cover");
    expect(viewport).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/i);
  });

  test("hides the banner in standalone mode", async ({ page }) => {
    test.skip(!hasE2eEnvironment, "Set local Supabase credentials to run PWA install checks.");
    await page.addInitScript(() => {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: (query: string) => ({ matches: query === "(display-mode: standalone)", media: query }),
      });
      Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    });

    const user = await createSeededUser();
    await signIn(page, "en", user);
    await expect(page.getByTestId("install-prompt")).toHaveCount(0);
  });

  test("keeps Settings install entry after a banner dismissal", async ({ page }) => {
    test.skip(!hasE2eEnvironment, "Set local Supabase credentials to run PWA install checks.");
    const user = await createSeededUser();
    await signIn(page, "en", user);
    await page.waitForTimeout(1_000);

    const wasCaptured = await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
      };
      Object.defineProperties(event, {
        prompt: { value: async () => undefined },
        userChoice: { value: Promise.resolve({ outcome: "dismissed" }) },
      });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(wasCaptured).toBe(true);
    await expect(page.getByTestId("install-prompt")).toBeVisible();
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(page.getByTestId("install-prompt")).toHaveCount(0);

    const openNavigation = page.getByRole("button", { name: "Open navigation" });
    if (await openNavigation.isVisible()) {
      await openNavigation.click();
      await page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "Settings" }).click();
    } else {
      await page.getByRole("link", { name: "Settings" }).click();
    }
    await expect(page).toHaveURL(/\/en\/w\/[^/]+\/settings$/);
    // M-8's "does not reappear on navigation" half. Workspace navigation is a full
    // document load (the sidebar renders plain anchors), so banner suppression rides
    // entirely on session storage — assert it survives the reload, not just the click.
    await expect(page.getByTestId("install-prompt")).toHaveCount(0);
    await expect(page.getByTestId("settings-install-entry")).toBeVisible();
    // M-8 requires the Settings entry to remain available after banner dismissal.
    // Its affordance is platform-dependent: iOS/manual browsers show guidance,
    // while a browser that supplies a new beforeinstallprompt event shows the
    // usable install action instead.
    await expect(
      page.getByText("Open your browser menu and choose Add to Home Screen.")
        .or(page.getByRole("button", { name: "Install app" })),
    ).toBeVisible();
  });
});
