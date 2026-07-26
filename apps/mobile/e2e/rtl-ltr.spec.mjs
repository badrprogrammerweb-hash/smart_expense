import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
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

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      yield* walk(path);
    } else if (/\.(tsx?|css)$/.test(entry.name)) {
      yield path;
    }
  }
}

// T050/T055: this asserts the MANIFEST DECLARATION only — it does not and
// cannot prove the Activity actually survives a real rotation/locale change
// on-device (no Appium/device in this environment; that is the manual
// sweep, quickstart.md). The inference from declaration to behaviour rests
// on documented, standard Android OS semantics: declaring a configuration
// change here tells the OS to deliver onConfigurationChanged() to the
// existing Activity instead of destroying and recreating it — the app
// overrides nothing further, which is the correct (no-op) response, since
// the WebView content already re-flows via CSS. Without this declaration,
// the OS's DEFAULT behaviour is to destroy and recreate the Activity on
// these changes, which would drop the WebView/JS context and any
// in-progress form input.
test("AndroidManifest.xml declares configChanges that prevent Activity recreation on orientation/locale changes", async () => {
  const manifest = await mobileSource("android", "app", "src", "main", "AndroidManifest.xml");

  for (const change of ["orientation", "screenSize", "locale"]) {
    assert.match(manifest, new RegExp(`android:configChanges="[^"]*\\b${change}\\b`));
  }
});

// iOS does not recreate its WKWebView on rotation by default, and this app
// has no custom orientation/reload override to defeat that default — the
// project's only Swift file is the unmodified, Capacitor-generated
// AppDelegate.
test("no custom iOS code overrides the default no-reload-on-rotation behaviour", async () => {
  const appDelegate = await mobileSource("ios", "App", "App", "AppDelegate.swift");

  assert.doesNotMatch(appDelegate, /viewWillTransition|reload|orientation/i);
});

// T051/FR-027: the shared root layout intentionally cannot know the request
// locale during static export (see app/layout.tsx) — LocaleDirectionSync is
// the ONE place that must correctly flip <html lang/dir> from the validated
// [locale] segment before paint, or every RTL/LTR-dependent style in the
// bundled UI (safe-area-left/right physical mapping, mirrored icons, `ps-`/
// `pe-` logical spacing) would render backwards.
test("LocaleDirectionSync sets both lang and dir from the validated locale segment", async () => {
  const localeDirectionSync = await webSource("components", "layout", "LocaleDirectionSync.tsx");

  assert.match(localeDirectionSync, /document\.documentElement\.lang = locale/);
  assert.match(localeDirectionSync, /document\.documentElement\.dir = directionForLocale\(locale\)/);
  assert.match(localeDirectionSync, /useLayoutEffect/);
});

// T051: native chrome must not hardcode an LTR-only assumption. Checking
// only for the absence of the literal words "ltr"/"rtl" would be nearly
// vacuous — a positional/directional bug would not announce itself with
// those words. Instead this isolates the actual backButton listener body
// and asserts it contains ONLY the two known-safe operations (history
// navigation, app exit) and none of the position/direction-sensitive APIs
// (coordinates, computed style, .dir reads) a locale-dependent bug would
// realistically use.
test("the back-button handler contains no positional or direction-sensitive logic", async () => {
  const capabilities = await mobileSource("src", "native", "capabilities.ts");

  const listenerMatch = capabilities.match(/addListener\("backButton",\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\}\);/);
  assert.ok(listenerMatch, "backButton listener not found in capabilities.ts");
  const body = listenerMatch[1];

  assert.match(body, /window\.history\.back\(\)/);
  assert.match(body, /App\.exitApp\(\)/);
  assert.doesNotMatch(body, /clientX|screenX|pageX|getComputedStyle|\.dir\b|matchMedia/);
});

// T054/FR-029: device safe-area insets (notches, home indicators) must be
// respected in both orientations. Physical (not logical) CSS properties are
// required — pairing padding-inline-start with safe-area-inset-left would
// swap the insets under RTL and clip content on the notched side in Arabic
// landscape (see globals.css's own comment on this exact point).
test("safe-area utilities use physical CSS properties and the viewport opts into edge-to-edge content", async () => {
  const [globalsCss, rootLayout] = await Promise.all([
    webSource("app", "globals.css"),
    webSource("app", "layout.tsx"),
  ]);

  assert.match(globalsCss, /padding-left:\s*env\(safe-area-inset-left\)/);
  assert.match(globalsCss, /padding-right:\s*env\(safe-area-inset-right\)/);
  assert.match(rootLayout, /viewportFit:\s*"cover"/);
});

// T052/FR-028: the viewport must never disable user/OS text scaling —
// otherwise no dynamic/enlarged font-size setting could ever take effect,
// regardless of anything else being correct.
test("the viewport never disables zoom or text scaling", async () => {
  const rootLayout = await webSource("app", "layout.tsx");

  assert.doesNotMatch(rootLayout, /userScalable|maximumScale|maximum-scale|user-scalable/);
});

// T052/FR-028: text sizing must stay relative (rem, via Tailwind's text-*
// utilities) rather than fixed px, so whatever scaling mechanism is
// available (Android's WebView respects the system font-size setting for
// rem/em text; iOS Safari/WKWebView does not auto-propagate Dynamic Type to
// web content — a documented WebKit limitation, not a bug here) can actually
// take effect without truncation/overlap. Scans every component/page/style
// file under apps/web, not a single representative file — a hardcoded px
// font-size anywhere would silently opt that element out of platform text
// scaling.
test("no component or stylesheet hardcodes a pixel font-size", async () => {
  const pixelFontSize = /font-size:\s*\d+(\.\d+)?px|text-\[\d+(\.\d+)?px\]/;
  const offenders = [];

  for await (const file of walk(resolve(webRoot, "app"))) {
    const content = await readFile(file, "utf8");
    if (pixelFontSize.test(content)) offenders.push(file);
  }
  for await (const file of walk(resolve(webRoot, "components"))) {
    const content = await readFile(file, "utf8");
    if (pixelFontSize.test(content)) offenders.push(file);
  }

  assert.deepEqual(offenders, []);
});

// T054: `min-h-11` is Tailwind's deterministic spacing scale (11 x 0.25rem =
// 2.75rem = 44px at the default 16px root font-size, which globals.css never
// overrides) — a source-level fact, not an assumption. This verifies HEIGHT
// only: WIDTH is not enforced by an explicit min-width rule, it follows from
// `flex-1` dividing the row evenly at realistic phone viewport widths
// (>=320px / 5 items ~= 64px). JSDOM has no layout engine, so neither
// dimension's ACTUAL COMPUTED size can be verified by a render test in this
// harness (a real Playwright/device measurement is deferred to the manual
// sweep, quickstart.md).
test("the bottom navigation's touch targets declare the 44px minimum height", async () => {
  const bottomNav = await webSource("components", "ui", "bottom-nav.tsx");

  assert.match(bottomNav, /min-h-11/);
  assert.match(bottomNav, /aria-label=\{navLabel\}/);
  assert.match(bottomNav, /aria-current=\{active \? "page" : undefined\}/);
});

// T053: WCAG 2.1 AA labels/roles/colour-contrast compliance across
// representative screens, including a mobile viewport, in both locales, is
// enforced by an existing axe-core Playwright suite — this is regression
// coverage confirming that suite still exists and still covers a
// mobile-sized viewport, not a duplicate of what it already asserts. It was
// also run live (both locales) against current Phase 16 code as a separate,
// direct verification step — see the Phase 7 completion summary.
// NOTE — a real scope boundary, not an oversight: this suite's tag filter
// (wcag2a/wcag2aa/wcag21aa) does NOT include axe-core's `target-size` rule,
// which is tagged wcag22aa and disabled by default in this axe-core version.
// Touch-target SIZE is therefore never axe-verified; the 44px height claim
// above rests entirely on the deterministic Tailwind-class inference, not on
// this suite. A real device screen-reader sweep (TalkBack/VoiceOver) is
// deferred to the manual sweep (quickstart.md).
test("the existing WCAG AA accessibility suite covers a mobile viewport in both locales", async () => {
  const accessibilitySpec = await webSource("e2e", "accessibility.spec.ts");

  assert.match(accessibilitySpec, /wcag2a.*wcag2aa.*wcag21aa|wcag21aa.*wcag2aa.*wcag2a/s);
  assert.match(accessibilitySpec, /width:\s*390,\s*height:\s*844/);
  assert.match(accessibilitySpec, /for \(const locale of \["ar", "en"\]/);
});
