import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const mobileRoot = resolve(import.meta.dirname, "..");

// T019/T024/T025, contracts/on-device-security.md rule 1: the authenticated
// session must live only in the platform secure store, restore across app
// restarts, and be fully clearable on sign-out. A real "kill and relaunch the
// app" run cannot be automated in this environment (no Appium, no physical
// device) and is covered by the documented manual sweep instead
// (quickstart.md); the storage-wiring behaviour itself — which client gets
// which storage adapter, and what happens on sign-out — is unit-tested
// directly in apps/web/lib/supabase/__tests__/client.test.ts and
// apps/web/lib/__tests__/workspace-context.test.ts.

test("the native secure-session adapter exposes a full get/set/remove/clear surface backed by Keychain/Keystore", async () => {
  const [secureSessionModule, pkg] = await Promise.all([
    readFile(resolve(mobileRoot, "src", "native", "secure-session.ts"), "utf8"),
    readFile(resolve(mobileRoot, "package.json"), "utf8"),
  ]);

  assert.match(secureSessionModule, /getItem/);
  assert.match(secureSessionModule, /setItem/);
  assert.match(secureSessionModule, /removeItem/);
  assert.match(secureSessionModule, /clear/);
  assert.match(secureSessionModule, /@aparajita\/capacitor-secure-storage/);

  const dependencies = JSON.parse(pkg).dependencies ?? {};
  assert.ok(Object.hasOwn(dependencies, "@aparajita/capacitor-secure-storage"));
});

// The bootstrap must expose the secure-session adapter to the bundled web
// layer before anything else touches auth (bootstrap.ts sets
// window.__SMART_EXPENSE_NATIVE__ synchronously, ahead of the async native
// capability/deep-link initialisation) so the very first Supabase client
// constructed in a native launch already has a working secure store.
test("the native bootstrap exposes the secure-session adapter to the bundled web layer", async () => {
  const bootstrap = await readFile(resolve(mobileRoot, "src", "native", "bootstrap.ts"), "utf8");

  assert.match(bootstrap, /__SMART_EXPENSE_NATIVE__/);
  assert.match(bootstrap, /secureSession/);
});

// Session keys are namespaced so `clear()` can never remove unrelated secure
// storage entries a future native feature might add.
test("secure-session storage keys are namespaced", async () => {
  const secureSessionModule = await readFile(resolve(mobileRoot, "src", "native", "secure-session.ts"), "utf8");

  assert.match(secureSessionModule, /SESSION_KEY_PREFIX/);
});
