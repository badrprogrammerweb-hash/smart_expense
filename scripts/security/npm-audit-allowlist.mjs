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
      "A Next.js release that pins postcss > 8.5.17. Next 16.2.12 pins it " +
      "exactly at 8.4.31, so this cannot be resolved without upgrading Next.",
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
    removedBy: "Same as GHSA-qx2v-qp2m-jg93 — a Next.js release pinning postcss > 8.5.17.",
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
    removedBy: "Same as GHSA-qx2v-qp2m-jg93 — a Next.js release pinning postcss > 8.5.17.",
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
