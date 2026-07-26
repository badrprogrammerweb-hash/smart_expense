import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const mobileRoot = resolve(import.meta.dirname, "..");

test("native shell has a locally bundled launch page and no remote server URL", async () => {
  const [config, launchPage] = await Promise.all([
    readFile(resolve(mobileRoot, "capacitor.config.ts"), "utf8"),
    access(resolve(mobileRoot, "www", "index.html")),
  ]);

  assert.match(config, /webDir:\s*"www"/);
  assert.doesNotMatch(config, /server\s*:\s*\{[^}]*url/s);
  assert.ok(launchPage === undefined);
});

// T020, contracts/native-shell-packaging.md rule 4: app identity must be
// correct and non-placeholder. "Smart Expense AI" is a proper brand name kept
// untranslated in both locales, matching the precedent already set by the
// Phase 15 PWA manifest and the in-app `appName` translation key (identical
// in messages/ar.json and messages/en.json) — no separate native localization
// of the display name is required.
test("declares a correct, non-placeholder app identity", async () => {
  const config = await readFile(resolve(mobileRoot, "capacitor.config.ts"), "utf8");

  assert.match(config, /appId:\s*"com\.smartexpense\.ai"/);
  assert.match(config, /appName:\s*"Smart Expense AI"/);
  assert.doesNotMatch(config, /appName:\s*"(App|MyApp|Untitled|TODO)"/i);
});

// FR-002: a complete icon set, including a maskable variant, must exist and
// must not be a placeholder. The source SVGs feed @capacitor/assets, which
// generates the platform-specific matrices asserted below.
test("provides a complete, non-empty icon and splash asset inventory", async () => {
  const iconSizes = [48, 72, 96, 128, 192, 256, 512];
  await Promise.all(iconSizes.map((size) => access(resolve(mobileRoot, "icons", `icon-${size}.webp`))));

  const sourceIcon = await readFile(resolve(mobileRoot, "resources", "icon.svg"), "utf8");
  const sourceSplash = await readFile(resolve(mobileRoot, "resources", "splash.svg"), "utf8");
  assert.ok(sourceIcon.length > 0);
  assert.ok(sourceSplash.length > 0);

  await access(resolve(mobileRoot, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "Contents.json"));
  await access(resolve(mobileRoot, "ios", "App", "App", "Assets.xcassets", "Splash.imageset", "Contents.json"));
  await access(resolve(mobileRoot, "android", "app", "src", "main", "res", "mipmap-xxxhdpi", "ic_launcher.png"));
  await access(resolve(mobileRoot, "android", "app", "src", "main", "res", "drawable", "splash.png"));
});

// FR-003, contracts/store-readiness.md rule 5: the app must declare no
// in-app-purchase entitlement and carry no billing surface at all — the
// complete product is free, with all support-purchase work deferred to
// Phase 17.
test("declares no in-app-purchase or billing surface at install", async () => {
  const pkg = JSON.parse(await readFile(resolve(mobileRoot, "package.json"), "utf8"));
  const allDependencyNames = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ];
  const iapPattern = /purchase|iap|billing|subscription/i;

  assert.deepEqual(allDependencyNames.filter((name) => iapPattern.test(name)), []);

  const config = await readFile(resolve(mobileRoot, "capacitor.config.ts"), "utf8");
  assert.doesNotMatch(config, iapPattern);
});
