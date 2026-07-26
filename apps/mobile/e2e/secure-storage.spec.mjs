import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const mobileRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(mobileRoot, "..", "..");
const webRoot = resolve(repositoryRoot, "apps", "web");

function mobileSource(...segments) {
  return readFile(resolve(mobileRoot, ...segments), "utf8");
}

function webSource(...segments) {
  return readFile(resolve(webRoot, ...segments), "utf8");
}

// T043/T045, contracts/on-device-security.md rule 1: the authenticated
// session must live ONLY in the platform secure store, never plain WebView
// storage. A real device-storage inspection (Keychain/Keystore dump on a
// physical device) cannot be automated in this environment (no Appium, no
// physical device) and is covered by the documented manual sweep instead
// (quickstart.md); the storage-wiring behaviour itself is unit-tested in
// apps/web/lib/supabase/__tests__/client.test.ts.
test("the session storage adapter never falls back to plain WebView storage while native", async () => {
  const sessionStore = await webSource("lib", "auth", "session-store.ts");

  assert.match(sessionStore, /nativeSecureSession/);
  assert.doesNotMatch(sessionStore, /window\.localStorage/);
  assert.doesNotMatch(sessionStore, /window\.sessionStorage/);
});

// T045, rule 1: closes the OS-level backup vector for the Keystore-encrypted
// SharedPreferences file the secure-storage plugin writes to on Android, and
// the iOS Keychain default (`whenUnlocked`) that migrates via an encrypted
// backup restore — both are outside the platform secure store's hardware
// boundary and would otherwise let the session (or its ciphertext) leave the
// device through a channel other than the app itself.
test("native projects exclude the session from OS-level backup/migration on both platforms", async () => {
  const [androidManifest, secureSessionModule] = await Promise.all([
    mobileSource("android", "app", "src", "main", "AndroidManifest.xml"),
    mobileSource("src", "native", "secure-session.ts"),
  ]);

  assert.match(androidManifest, /android:allowBackup="false"/);
  assert.match(secureSessionModule, /setDefaultKeychainAccess/);
  assert.match(secureSessionModule, /whenUnlockedThisDeviceOnly/);
});

// T048, rule 2: no AI provider key, Vault value, or internal database
// identifier may be persisted or exposed anywhere in the native or bundled
// web source. AI keys are BYOK, stored server-side via Supabase Vault
// (Phase 7) and never touch the client at all.
test("no AI provider key or Vault value is ever persisted client-side", async () => {
  const [aiSettingsApi, sessionStore, secureSessionModule] = await Promise.all([
    webSource("lib", "api", "ai-settings.ts"),
    webSource("lib", "auth", "session-store.ts"),
    mobileSource("src", "native", "secure-session.ts"),
  ]);

  // Matches actual API usage (`window.localStorage`, `indexedDB.open`, ...),
  // not the word appearing in prose — session-store.ts's own docstring
  // explains it "never falls back to WebView localStorage while native",
  // which must not itself trip this check.
  const plainStorageUsage = /window\.(localStorage|sessionStorage)\b|\bindexedDB\b/;
  for (const source of [aiSettingsApi, sessionStore, secureSessionModule]) {
    assert.doesNotMatch(source, plainStorageUsage);
  }
  // `apiKey` legitimately exists as a write-only input the user submits TO
  // the backend when configuring a key — the security property is that the
  // READ/status shape the client stores in state never echoes a raw key
  // back, only a masked hint.
  assert.match(aiSettingsApi, /masked_hint/);
  assert.doesNotMatch(aiSettingsApi, /AiSettingsStatus\s*=\s*\{[^}]*\bapiKey\b/s);
});

// T048, rule 7: receipt/invoice content — captured or picked — must never be
// written to a persistent device location. The camera bridge converts the
// native photo straight to an in-memory File; nothing calls the Filesystem
// plugin to write it to disk, and saveToGallery stays false (verified
// separately in capture-upload.spec.mjs).
test("captured receipt content is never written to a persistent device location", async () => {
  const cameraModule = await mobileSource("src", "native", "camera.ts");

  assert.doesNotMatch(cameraModule, /@capacitor\/filesystem/i);
  assert.doesNotMatch(cameraModule, /Filesystem\.(writeFile|write)/);
});

// T046/FR-023: workspace-scoped in-memory data must be scoped to one
// user/workspace and never written to persistent storage — the exact
// mechanism that makes cross-workspace/cross-user leakage structurally
// impossible rather than something that must be remembered to scrub.
test("workspace and financial data are never persisted to device storage", async () => {
  const providers = await webSource("components", "providers.tsx");

  assert.doesNotMatch(providers, /persistQueryClient|createSyncStoragePersister|createAsyncStoragePersister/);
});
