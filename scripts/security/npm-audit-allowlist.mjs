/**
 * Explicitly accepted production npm audit findings.
 *
 * This is a risk register, not a mute button. Every entry names one advisory
 * against one package at one version reached by one dependency path. Anything
 * that does not match exactly — a new advisory, a new package, a version bump,
 * a changed path — fails the policy check and has to be re-reviewed here.
 *
 * Severity is deliberately NOT a field. Nothing is accepted because it is
 * "only moderate"; each entry is accepted because the vulnerable code is not
 * reachable in this application, and says why.
 *
 * Fields:
 *   package        npm package the advisory is filed against
 *   advisory       GHSA id (stable across audit runs; npm's numeric `source`
 *                  is not guaranteed stable, so it is not the key)
 *   version        exact installed version this acceptance was reviewed against
 *   path           node_modules path npm reports for the vulnerable copy
 *   reason         why the vulnerable code cannot be reached today
 *   invalidatedBy  code changes that would make it reachable — if you are
 *                  doing one of these, this entry must be re-reviewed
 *   removedBy      the dependency change that eventually deletes this entry
 */

/** @type {ReadonlyArray<{package:string,advisory:string,version:string,path:string,reason:string,invalidatedBy:string[],removedBy:string}>} */
export const ACCEPTED_FINDINGS = [
  {
    package: "postcss",
    advisory: "GHSA-qx2v-qp2m-jg93",
    version: "8.4.31",
    path: "node_modules/postcss",
    reason:
      "XSS via unescaped </style> in stringify output. PostCSS runs only at " +
      "build time, over first-party stylesheets committed to this repo. No " +
      "user-supplied CSS exists: there is no theming feature, no CSS stored " +
      "in or served from the database, and no stylesheet derived from request " +
      "input. The stringified output is a static asset, not a response body.",
    invalidatedBy: [
      "Compiling any CSS whose content originates from user input or the database",
      "Adding runtime (request-time) PostCSS processing",
      "Introducing user-authored themes or style customization",
    ],
    removedBy:
      "An upstream-compatible resolution to postcss >= 8.5.23. That is the " +
      "floor for every PostCSS residual here: GHSA-fxqj-rqcc-2cmp affects " +
      "through 8.5.22, so clearing this one alone is not enough to drop the " +
      "vulnerable copy. Next 16.2.12 pins postcss exactly at 8.4.31, so this " +
      "cannot be resolved without upgrading Next — and deliberately not with " +
      "an npm override.",
  },
  {
    package: "postcss",
    advisory: "GHSA-6g55-p6wh-862q",
    version: "8.4.31",
    path: "node_modules/postcss",
    reason:
      "Arbitrary file read via attacker-controlled sourceMappingURL in a CSS " +
      "comment. Requires attacker-authored CSS reaching the compiler; only " +
      "first-party build-time stylesheets do.",
    invalidatedBy: [
      "Compiling CSS from any untrusted source",
      "Accepting uploaded or third-party stylesheets into the build",
    ],
    removedBy:
      "Same as GHSA-qx2v-qp2m-jg93 — an upstream-compatible resolution to " +
      "postcss >= 8.5.23.",
  },
  {
    package: "postcss",
    advisory: "GHSA-r28c-9q8g-f849",
    version: "8.4.31",
    path: "node_modules/postcss",
    reason:
      "Path traversal in previous-source-map auto-loading. Same reachability " +
      "argument: only first-party CSS and its own build-time source maps are " +
      "ever loaded.",
    invalidatedBy: [
      "Compiling CSS from any untrusted source",
      "Loading source maps from a location writable by anyone but the build",
    ],
    removedBy:
      "Same as GHSA-qx2v-qp2m-jg93 — an upstream-compatible resolution to " +
      "postcss >= 8.5.23.",
  },
  {
    package: "postcss",
    advisory: "GHSA-fxqj-rqcc-2cmp",
    version: "8.4.31",
    path: "node_modules/postcss",
    reason:
      "CVE-2026-69153 — incomplete fix of GHSA-6g55-p6wh-862q. Arbitrary .map " +
      "file read when a malicious sourceMappingURL is processed without a " +
      "reliable `from` value. Exploitation needs all three of: attacker-authored " +
      "CSS reaching PostCSS, processing without a trustworthy `from`, and the " +
      "generated source map being exposed or consumed. None exist here. The only " +
      "stylesheet compiled by this app is the first-party apps/web/app/globals.css " +
      "(imported at apps/web/app/layout.tsx:7); PostCSS runs solely inside " +
      "`next build`/`next dev` over repo-committed CSS. No first-party code " +
      "imports postcss or calls .process() (apps/web has zero route handlers, so " +
      "there is no runtime CSS endpoint at all), no migration stores CSS/theme/" +
      "style content, and uploads are magic-byte sniffed and restricted to " +
      "image/png, image/jpeg, image/webp and application/pdf — a stylesheet " +
      "cannot enter the system as data. Nothing reads result.map, " +
      "productionBrowserSourceMaps is unset (default false), and no .map file " +
      "ships in apps/web/public or the exported apps/web/out. Secondary note: the " +
      "plugin that actually compiles globals.css, @tailwindcss/postcss, carries " +
      "its own patched postcss 8.5.25; this 8.4.31 copy is Next.js's internal one.",
    invalidatedBy: [
      "Accepting user-supplied CSS, uploaded stylesheets, or user-authored themes",
      "Calling PostCSS at runtime on any user-controlled string",
      "Exposing a PostCSS result.map, or serving build-generated source maps",
      "Adding a CSS playground, minifier, linter, or per-tenant build service",
      "Changing the installed PostCSS version or the node_modules/postcss path",
    ],
    removedBy:
      "An upstream-compatible resolution to postcss >= 8.5.23. next@16.2.12 " +
      "declares `\"postcss\": \"8.4.31\"` as an exact pin (see package-lock.json), " +
      "so this cannot be resolved without a Next.js upgrade — and deliberately " +
      "not with an npm override. Delete this entry as soon as such a release lands.",
  },
  {
    package: "sharp",
    advisory: "GHSA-f88m-g3jw-g9cj",
    version: "0.34.5",
    path: "node_modules/sharp",
    reason:
      "Inherited libvips CVEs (CVE-2026-33327/33328/35590/35591). sharp is an " +
      "optional transitive of Next.js, reachable only through the Image " +
      "Optimization endpoint. This app never routes attacker-controlled bytes " +
      "there: it imports next/image nowhere, configures no images.remotePatterns " +
      "(so remote URLs are refused), sets no dangerouslyAllowSVG, and ships no " +
      "SVG in public/. Uploaded receipts render through plain <img> tags from " +
      "Supabase Storage and never transit the Next.js server.",
    invalidatedBy: [
      "Importing next/image anywhere in apps/web",
      "Adding images.remotePatterns or images.domains to next.config.js",
      "Enabling dangerouslyAllowSVG",
      "Serving user uploads through the Next.js image optimizer",
    ],
    removedBy:
      "A Next.js release whose optionalDependencies allow sharp >= 0.35.0. " +
      "Next 16.2.12 declares ^0.34.5, which cannot resolve 0.35.x.",
  },
];

/**
 * Packages accepted only as a *consequence* of allowlisted child advisories.
 *
 * npm reports a parent as vulnerable purely because a dependency is ("Depends
 * on vulnerable versions of ..."), with no advisory of its own. Such an entry
 * is accepted only when every package it derives from is itself fully
 * allowlisted — so a genuinely new advisory filed against the parent still
 * fails the check.
 */
export const DERIVED_ONLY_PACKAGES = new Set(["next"]);
