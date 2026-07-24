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

// T036/T038: the standard `capture` file-input attribute is unreliable on
// iOS WKWebView, so the native shell must prefer @capacitor/camera over it —
// falling back to the web capture attribute only when the native bridge is
// unavailable (no dead control, FR-020). A real device-level "tap the shutter"
// run cannot be automated in this environment (no Appium, no physical device)
// and is covered by the documented manual sweep instead (quickstart.md); the
// actual capture/preview/error-handling logic is unit-tested directly in
// apps/web/components/ui/__tests__/file-upload.test.tsx and
// apps/web/components/files/__tests__/file-upload.test.tsx.
test("the native camera bridge exists, is exposed to the web layer, and classifies every takePhoto outcome", async () => {
  const [cameraModule, bootstrap] = await Promise.all([
    mobileSource("src", "native", "camera.ts"),
    mobileSource("src", "native", "bootstrap.ts"),
  ]);

  assert.match(cameraModule, /Camera\.takePhoto/);
  assert.match(cameraModule, /saveToGallery:\s*false/);
  for (const status of ["captured", "cancelled", "permission-denied", "unavailable", "failed"]) {
    assert.match(cameraModule, new RegExp(status.replace("-", "\\-")));
  }
  assert.match(bootstrap, /captureFromCamera/);
  assert.match(bootstrap, /__SMART_EXPENSE_NATIVE__/);
});

test("the web shell prefers native capture and falls back to the web capture attribute when unavailable", async () => {
  const [platformBridge, fileUploadPrimitive] = await Promise.all([
    webSource("lib", "platform", "capacitor.ts"),
    webSource("components", "ui", "file-upload.tsx"),
  ]);

  assert.match(platformBridge, /export function nativeCamera/);
  assert.match(fileUploadPrimitive, /nativeCaptureAvailable/);
  assert.match(fileUploadPrimitive, /handleNativeCapture/);
  assert.match(fileUploadPrimitive, /capture="environment"/);
});

// A fast double-tap must not fire a second concurrent takePhoto() before the
// native camera screen has visibly taken over.
test("the capture button guards against a concurrent second invocation", async () => {
  const fileUploadPrimitive = await webSource("components", "ui", "file-upload.tsx");

  assert.match(fileUploadPrimitive, /isCapturing/);
  assert.match(fileUploadPrimitive, /disabled \|\| isCapturing/);
});

// iOS terminates the app the instant camera permission is requested without
// a usage-description string — this is an OS-level crash, not a graceful
// denial. Android infers the CAMERA permission as a required device feature
// (filtering camera-less devices out of the Play Store) unless explicitly
// overridden, which would contradict "file selection remains usable where
// camera is unavailable" (FR-020).
test("native projects declare camera permissions correctly for both platforms", async () => {
  const [infoPlist, androidManifest] = await Promise.all([
    mobileSource("ios", "App", "App", "Info.plist"),
    mobileSource("android", "app", "src", "main", "AndroidManifest.xml"),
  ]);

  assert.match(infoPlist, /<key>NSCameraUsageDescription<\/key>/);
  assert.match(androidManifest, /<uses-permission android:name="android\.permission\.CAMERA" \/>/);
  assert.match(androidManifest, /<uses-feature android:name="android\.hardware\.camera" android:required="false" \/>/);
});

// T040/T041: retry-yields-one-file relies on the SAME guarded upload path and
// UNCHANGED Phase 6 validation regardless of capture source (camera or file
// picker) — no separate, divergent native upload code path exists.
test("captured and picked files share one guarded upload path with unchanged Phase 6 validation", async () => {
  const domainUpload = await webSource("components", "files", "FileUpload.tsx");

  assert.match(domainUpload, /MAX_FILE_SIZE_BYTES = 10 \* 1024 \* 1024/);
  assert.match(domainUpload, /ALLOWED_TYPES = new Set\(\["image\/png", "image\/jpeg", "image\/webp", "application\/pdf"\]\)/);
  assert.match(domainUpload, /isUploading \|\| !canMutate/);
  assert.match(domainUpload, /uploadFile\(workspaceId, \{ file: selectedFile \}\)/);
  assert.match(domainUpload, /onCaptureError=\{onCaptureError\}/);
});
