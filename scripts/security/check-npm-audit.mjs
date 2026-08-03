#!/usr/bin/env node
/**
 * Blocking production npm audit policy.
 *
 * Runs `npm audit --omit=dev --json` and compares every production finding
 * against the explicit allowlist in ./npm-audit-allowlist.mjs. Exits 0 only
 * when the set of findings matches the register exactly.
 *
 * It fails on:
 *   - an advisory not in the allowlist
 *   - a vulnerable package not in the allowlist
 *   - an allowlisted advisory whose installed version has changed
 *   - an allowlisted advisory reported at a different dependency path
 *   - audit output that cannot be parsed
 *
 * It deliberately does NOT suppress by severity, and never runs `npm audit fix`.
 *
 * Usage:
 *   node scripts/security/check-npm-audit.mjs
 *   node scripts/security/check-npm-audit.mjs --audit-json <file> [--modules-root <dir>]
 *
 * The --audit-json / --modules-root flags exist so the policy can be tested
 * against fixtures without a network call or a particular node_modules tree.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ACCEPTED_FINDINGS,
  DERIVED_ONLY_PACKAGES,
} from "./npm-audit-allowlist.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export class AuditPolicyError extends Error {}

/** Parse audit JSON, failing loudly rather than treating garbage as "clean". */
export function parseAuditReport(raw) {
  let report;
  try {
    report = JSON.parse(raw);
  } catch (cause) {
    throw new AuditPolicyError(
      `npm audit did not produce valid JSON: ${cause.message}`,
    );
  }
  if (report === null || typeof report !== "object" || Array.isArray(report)) {
    throw new AuditPolicyError("npm audit JSON is not an object.");
  }
  // An audit with no findings legitimately omits `vulnerabilities`; a report
  // where it is present but the wrong shape is corrupt, not empty.
  if (report.vulnerabilities === undefined) return {};
  if (
    report.vulnerabilities === null ||
    typeof report.vulnerabilities !== "object" ||
    Array.isArray(report.vulnerabilities)
  ) {
    throw new AuditPolicyError("npm audit JSON has a malformed `vulnerabilities` map.");
  }
  return report.vulnerabilities;
}

/** Read an installed package version from disk, or null when absent. */
export function readInstalledVersion(modulesRoot, nodePath) {
  try {
    const manifest = JSON.parse(
      readFileSync(path.join(modulesRoot, nodePath, "package.json"), "utf8"),
    );
    return typeof manifest.version === "string" ? manifest.version : null;
  } catch {
    return null;
  }
}

function advisoryIdFromUrl(url) {
  if (typeof url !== "string") return null;
  const match = url.match(/GHSA-[0-9a-z-]+/i);
  return match ? match[0] : null;
}

/**
 * Compare audit findings against the allowlist.
 *
 * Pure over its inputs so tests can drive it with fixtures. `resolveVersion`
 * takes a node_modules path and returns the installed version or null.
 */
export function evaluate(vulnerabilities, { resolveVersion }) {
  const accepted = [];
  const problems = [];
  const matchedKeys = new Set();

  const allowByKey = new Map(
    ACCEPTED_FINDINGS.map((entry) => [`${entry.package}::${entry.advisory}`, entry]),
  );

  for (const [name, record] of Object.entries(vulnerabilities)) {
    const via = Array.isArray(record?.via) ? record.via : [];
    const advisories = via.filter((item) => item && typeof item === "object");
    const derivedFrom = via.filter((item) => typeof item === "string");

    if (advisories.length === 0) {
      // No advisory of its own — vulnerable only through its dependencies.
      if (!DERIVED_ONLY_PACKAGES.has(name)) {
        problems.push(
          `${name}: reported vulnerable with no advisory of its own and is not a ` +
            `known derived-only package. Review it explicitly.`,
        );
        continue;
      }
      const unknownParents = derivedFrom.filter(
        (dep) => !ACCEPTED_FINDINGS.some((entry) => entry.package === dep),
      );
      if (unknownParents.length > 0) {
        problems.push(
          `${name}: derives from package(s) not in the allowlist: ${unknownParents.join(", ")}.`,
        );
        continue;
      }
      accepted.push({
        package: name,
        advisory: "(derived)",
        detail: `accepted via allowlisted ${derivedFrom.join(", ")}`,
      });
      continue;
    }

    for (const advisory of advisories) {
      const id = advisoryIdFromUrl(advisory.url) ?? `source:${advisory.source}`;
      const key = `${name}::${id}`;
      const entry = allowByKey.get(key);

      if (!entry) {
        problems.push(
          `${name}: unaccepted advisory ${id} — ${advisory.title ?? "no title"} (${advisory.url ?? "no url"}).`,
        );
        continue;
      }

      const nodes = Array.isArray(record.nodes) ? record.nodes : [];
      if (!nodes.includes(entry.path)) {
        problems.push(
          `${name} ${id}: expected dependency path "${entry.path}" but npm reported [${nodes.join(", ") || "none"}]. ` +
            `The acceptance was reviewed for a specific path; re-review it.`,
        );
        continue;
      }

      const installed = resolveVersion(entry.path);
      if (installed === null) {
        problems.push(
          `${name} ${id}: could not read an installed version at "${entry.path}" to confirm the acceptance.`,
        );
        continue;
      }
      if (installed !== entry.version) {
        problems.push(
          `${name} ${id}: allowlisted for version ${entry.version} but ${installed} is installed. ` +
            `Re-review the finding against the new version.`,
        );
        continue;
      }

      matchedKeys.add(key);
      accepted.push({ package: name, advisory: id, detail: `${installed} at ${entry.path}` });
    }
  }

  // A stale entry is a documentation bug, not a security failure: report it so
  // the register can be pruned, but do not fail the build over it.
  const stale = ACCEPTED_FINDINGS.filter(
    (entry) => !matchedKeys.has(`${entry.package}::${entry.advisory}`),
  ).map((entry) => `${entry.package} ${entry.advisory}`);

  return { accepted, problems, stale };
}

function runNpmAudit() {
  try {
    return execFileSync("npm", ["audit", "--omit=dev", "--json"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      shell: process.platform === "win32",
    });
  } catch (error) {
    // npm exits nonzero whenever findings exist, so stdout is the real result.
    // Only a genuinely empty stdout means the command itself failed.
    if (typeof error.stdout === "string" && error.stdout.trim() !== "") {
      return error.stdout;
    }
    throw new AuditPolicyError(
      `Could not run \`npm audit --omit=dev --json\`: ${error.message}`,
    );
  }
}

function parseArgs(argv) {
  const options = { auditJson: null, modulesRoot: REPO_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--audit-json") options.auditJson = argv[index + 1];
    if (argv[index] === "--modules-root") options.modulesRoot = argv[index + 1];
  }
  return options;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const raw = options.auditJson
    ? readFileSync(options.auditJson, "utf8")
    : runNpmAudit();

  const vulnerabilities = parseAuditReport(raw);
  const { accepted, problems, stale } = evaluate(vulnerabilities, {
    resolveVersion: (nodePath) => readInstalledVersion(options.modulesRoot, nodePath),
  });

  if (accepted.length > 0) {
    console.log("Accepted production residuals (documented in npm-audit-allowlist.mjs):");
    for (const item of accepted) {
      console.log(`  - ${item.package} ${item.advisory}: ${item.detail}`);
    }
  } else {
    console.log("No production audit findings.");
  }

  if (stale.length > 0) {
    console.log(
      `\nAllowlist entries no longer reported (safe to delete): ${stale.join(", ")}`,
    );
  }

  if (problems.length > 0) {
    console.error("\nProduction audit policy FAILED:");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      "\nEach item above is a production finding that is not an accepted residual.\n" +
        "Fix the dependency, or — only with a written reachability argument — add an\n" +
        "entry to scripts/security/npm-audit-allowlist.mjs. Do not run `npm audit fix`.",
    );
    return 1;
  }

  console.log("\nProduction audit policy passed: no unexpected findings.");
  return 0;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(
      error instanceof AuditPolicyError
        ? `Production audit policy FAILED: ${error.message}`
        : error,
    );
    process.exit(1);
  }
}
