import { readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = resolve(scriptDirectory, "..");
const repositoryDirectory = resolve(webDirectory, "..", "..");

export const SUPPORT_TRANSLATION_KEY = "supportPurchases";

// Optional Arabic diacritics (fathatan..sukun, superscript alef) and tatweel.
// Allowing them between letters makes the blacklist tolerant of vocalized and
// kashida-stretched spellings such as a shadda-marked "tabarru" without
// listing each variant. Built from code points so the source stays pure ASCII:
// bare combining marks are invisible here and easy for an editor to mangle.
const ARABIC_MARK_RANGES = [
  [0x064b, 0x0652], // fathatan .. sukun (includes shadda U+0651)
  [0x0670, 0x0670], // superscript alef
  [0x0640, 0x0640], // tatweel / kashida
];
const ARABIC_MARK_CLASS = `[${ARABIC_MARK_RANGES.map(([start, end]) =>
  start === end
    ? String.fromCodePoint(start)
    : `${String.fromCodePoint(start)}-${String.fromCodePoint(end)}`,
).join("")}]*`;

// Charitable/fundraising wording that must never appear in support-purchase
// copy (FR-002, SC-007). These strings exist ONLY here and in this lint's
// tests; they must never be introduced into translations or any UI surface.
//
// Ordered longest-first so an alternation reports the most specific matched
// term (e.g. "تبرعات" rather than the "تبرع" it contains).
export const PROHIBITED_ARABIC_TERMS = [
  "تبرعات",
  "تبرع",
  "صدقات",
  "صدقة",
  "خيرية",
  "خيري",
];

// Arabic is matched WITHOUT `\b`. JavaScript word boundaries are defined on
// ASCII `[A-Za-z0-9_]` even under the `u` flag, so `\bتبرع\b` can never match.
// Substring matching is also what catches the clitic-prefixed forms Arabic
// actually uses in prose ("التبرع", "والتبرعات", "المتبرع").
function arabicTermSource(term) {
  return [...term].join(ARABIC_MARK_CLASS);
}

const englishPatternSource = String.raw`\b(?:don(?:at(?:e|ed|es|ing|ion|ions)|ors?)|charit(?:y|ies|able|ably)|fund(?:-|\s)?rais(?:ing|er|ers))\b`;
const arabicPatternSource = `(?:${PROHIBITED_ARABIC_TERMS.map(arabicTermSource).join("|")})`;
const prohibitedPatternSource = `(?:${englishPatternSource}|${arabicPatternSource})`;

const fixedProductionSources = [
  "apps/api/app/core/support_tiers.py",
  "apps/api/app/routes/support_purchases.py",
  "apps/api/app/schemas/support_purchases.py",
  "apps/mobile/src/native/billing.ts",
];

// Tests, snapshots, type declarations, dependencies, and build output are
// excluded deliberately and narrowly: this lint governs shipped product copy,
// and this lint's own tests must be able to contain the blacklisted terms.
const EXCLUDED_FILE_PATTERN =
  /(?:\.(?:test|spec|stories)\.[cm]?[jt]sx?|\.d\.ts|\.snap)$/u;
const EXCLUDED_DIRECTORIES = new Set([
  "__tests__",
  "__snapshots__",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
]);

function sourceLabel(absolutePath) {
  return relative(repositoryDirectory, absolutePath).replaceAll("\\", "/");
}

function isScannableFile(name) {
  return /\.(?:ts|tsx)$/u.test(name) && !EXCLUDED_FILE_PATTERN.test(name);
}

async function readTextFile(absolutePath) {
  try {
    return await readFile(absolutePath, "utf8");
  } catch (cause) {
    throw new Error(
      `Support-purchase copy lint could not read required source "${sourceLabel(absolutePath)}".`,
      { cause },
    );
  }
}

function assertScanned(values, description) {
  if (values.length === 0) {
    throw new Error(
      `Support-purchase copy lint resolved no ${description}. The configured scan scope is stale — repair the scope rather than letting the lint pass without scanning it.`,
    );
  }
  return values;
}

function positionAt(text, index) {
  const before = text.slice(0, index);
  const line = before.split(/\r?\n/u).length;
  const lastNewline = before.lastIndexOf("\n");
  return {
    line,
    column: index - lastNewline,
  };
}

export function findProhibitedSupportCopy(text, source = "inline") {
  const matches = [];
  const pattern = new RegExp(prohibitedPatternSource, "giu");

  for (const match of text.matchAll(pattern)) {
    const position = positionAt(text, match.index ?? 0);
    matches.push({
      source,
      line: position.line,
      column: position.column,
      term: match[0],
    });
  }

  return matches;
}

export function formatSupportCopyIssues(issues) {
  return issues
    .map(
      (issue) =>
        `${issue.source}:${issue.line}:${issue.column} prohibited support-purchase wording "${issue.term}"`,
    )
    .join("\n");
}

export function assertSupportCopyCompliant(text, source = "inline") {
  const issues = findProhibitedSupportCopy(text, source);
  if (issues.length > 0) {
    throw new Error(formatSupportCopyIssues(issues));
  }
}

export function collectSupportTranslationStrings(
  value,
  source,
  keyPath = SUPPORT_TRANSLATION_KEY,
) {
  if (typeof value === "string") {
    return [{ source: `${source}#${keyPath}`, text: value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectSupportTranslationStrings(entry, source, `${keyPath}[${index}]`),
    );
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .flatMap((key) =>
        collectSupportTranslationStrings(
          value[key],
          source,
          `${keyPath}.${key}`,
        ),
      );
  }
  return [];
}

/**
 * Fail closed when a supported locale stops exposing the support-purchase
 * subtree. Silently skipping it would let a rename move shipped copy out of
 * scope while this lint still exits zero.
 */
export function collectLocaleSupportTargets(parsed, source) {
  const subtree =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed[SUPPORT_TRANSLATION_KEY]
      : undefined;
  if (!subtree || typeof subtree !== "object" || Array.isArray(subtree)) {
    throw new Error(
      `Support-purchase copy lint requires a "${SUPPORT_TRANSLATION_KEY}" object in ${source}. Every supported locale must expose this subtree so its copy is scanned.`,
    );
  }
  return assertScanned(
    collectSupportTranslationStrings(subtree, source),
    `translated strings under "${SUPPORT_TRANSLATION_KEY}" in ${source}`,
  );
}

async function supportComponentSources() {
  const directory = resolve(webDirectory, "components", "settings");
  const entries = await readdir(directory, { withFileTypes: true });
  return assertScanned(
    entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.startsWith("Support") &&
          isScannableFile(entry.name),
      )
      .map((entry) => resolve(directory, entry.name))
      .sort(),
    "support-purchase web components in components/settings",
  );
}

async function supportRouteSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      paths.push(...(await supportRouteSources(entryPath)));
    } else if (entry.isFile() && isScannableFile(entry.name)) {
      paths.push(entryPath);
    }
  }

  return paths;
}

async function translationTargets() {
  const messagesDirectory = resolve(webDirectory, "messages");
  const entries = await readdir(messagesDirectory, { withFileTypes: true });
  const localeFiles = assertScanned(
    entries
      .filter(
        (candidate) => candidate.isFile() && candidate.name.endsWith(".json"),
      )
      .sort((left, right) => left.name.localeCompare(right.name)),
    "locale message files in apps/web/messages",
  );

  const targets = [];
  for (const entry of localeFiles) {
    const path = resolve(messagesDirectory, entry.name);
    const label = sourceLabel(path);
    let parsed;
    try {
      parsed = JSON.parse(await readTextFile(path));
    } catch (cause) {
      throw new Error(
        `Support-purchase copy lint could not parse locale file "${label}".`,
        { cause },
      );
    }
    targets.push(...collectLocaleSupportTargets(parsed, label));
  }

  return targets;
}

export async function scanConfiguredSupportCopy() {
  const sourcePaths = [
    ...fixedProductionSources.map((path) => resolve(repositoryDirectory, path)),
    ...(await supportComponentSources()),
    ...assertScanned(
      await supportRouteSources(
        resolve(
          webDirectory,
          "app",
          "[locale]",
          "(app)",
          "settings",
          "support",
        ),
      ),
      "support-purchase web route files",
    ),
  ].sort((left, right) => sourceLabel(left).localeCompare(sourceLabel(right)));

  const targets = await translationTargets();
  for (const path of sourcePaths) {
    targets.push({
      source: sourceLabel(path),
      text: await readTextFile(path),
    });
  }

  const issues = targets
    .flatMap((target) =>
      findProhibitedSupportCopy(target.text, target.source),
    )
    .sort(
      (left, right) =>
        left.source.localeCompare(right.source) ||
        left.line - right.line ||
        left.column - right.column ||
        left.term.localeCompare(right.term),
    );

  return {
    issues,
    scannedTargets: targets.length,
    // Source labels only — never the scanned text — so tests can assert the
    // configured scope without duplicating the scanner's own logic.
    sources: targets.map((target) => target.source),
  };
}

export async function main() {
  const result = await scanConfiguredSupportCopy();
  if (result.issues.length > 0) {
    console.error(formatSupportCopyIssues(result.issues));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Support-purchase copy lint passed (${result.scannedTargets} production strings/files scanned).`,
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (invokedPath === import.meta.url) {
  await main();
}
