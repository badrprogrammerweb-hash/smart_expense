import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const mobileRoot = resolve(import.meta.dirname, "..");

// T014/T018, contracts/auth-deeplink.md rule 3: provider (OAuth) sign-in must
// return through a registered deep link. This is regression coverage for the
// native registration itself — a device-level "tap through a real provider
// consent screen" run cannot be automated in this environment (no Appium, no
// physical device) and is covered by the documented manual sweep instead
// (quickstart.md); the web-side session-completion logic that consumes this
// deep link is unit-tested directly in
// apps/web/components/platform/__tests__/NativeDeepLinkRouter.test.tsx.

test("registers the smartexpense://auth/callback deep link on Android", async () => {
  const manifest = await readFile(
    resolve(mobileRoot, "android", "app", "src", "main", "AndroidManifest.xml"),
    "utf8",
  );

  assert.match(manifest, /android:scheme="smartexpense"/);
  assert.match(manifest, /android:host="auth"/);
  assert.match(manifest, /android:pathPrefix="\/callback"/);
  assert.match(manifest, /android:name="android\.intent\.action\.VIEW"/);
  assert.match(manifest, /android:name="android\.intent\.category\.BROWSABLE"/);
});

test("registers the smartexpense:// URL scheme on iOS", async () => {
  const infoPlist = await readFile(resolve(mobileRoot, "ios", "App", "App", "Info.plist"), "utf8");

  assert.match(infoPlist, /<string>smartexpense<\/string>/);
  assert.match(infoPlist, /CFBundleURLSchemes/);
});

// contracts/auth-deeplink.md rule 4: the redirect target is additive Supabase
// auth configuration, not a backend endpoint or financial API contract.
test("registers the deep-link redirect with local Supabase auth config", async () => {
  const supabaseConfig = await readFile(resolve(mobileRoot, "..", "..", "supabase", "config.toml"), "utf8");

  assert.match(supabaseConfig, /smartexpense:\/\/auth\/callback/);
});

// T013: the native deep-link handler must exist, capture the app's cold-start
// launch URL (not just live appUrlOpen events, so a cold-start return is not
// missed — spec.md Edge Cases), and be wired into the shared native bootstrap
// that every launch runs.
test("the native deep-link module captures the launch URL and live app-url-open events", async () => {
  const deepLinkModule = await readFile(resolve(mobileRoot, "src", "native", "deep-link.ts"), "utf8");

  assert.match(deepLinkModule, /registerDeepLinkHandler/);
  assert.match(deepLinkModule, /getLaunchUrl/);
  assert.match(deepLinkModule, /appUrlOpen/);
});

test("the native bootstrap wires the deep-link handler on every launch", async () => {
  const bootstrap = await readFile(resolve(mobileRoot, "src", "native", "bootstrap.ts"), "utf8");

  assert.match(bootstrap, /registerDeepLinkHandler/);
});
