/**
 * Fixture-driven tests for the production npm audit policy.
 *
 * Run with the repository's existing Node test runner:
 *   node --test scripts/security/check-npm-audit.test.mjs
 *
 * Every case is deterministic: no network, no npm invocation, no dependency on
 * the real node_modules tree. Installed versions are supplied through the
 * injected `resolveVersion`, so version-drift can be simulated exactly.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AuditPolicyError,
  evaluate,
  parseAuditReport,
} from "./check-npm-audit.mjs";
import { ACCEPTED_FINDINGS } from "./npm-audit-allowlist.mjs";

const INSTALLED = {
  "node_modules/postcss": "8.4.31",
  "node_modules/sharp": "0.34.5",
};

const resolveVersion = (nodePath) => INSTALLED[nodePath] ?? null;

// Mirrors the `via` entries of the real `npm audit --omit=dev --json` output,
// verbatim (source ids and advisory URLs included) — a fixture that drifts from
// the real report is exactly the failure this file exists to catch.
const postcssAdvisories = [
  { source: 1117015, url: "https://github.com/advisories/GHSA-qx2v-qp2m-jg93", title: "XSS" },
  { source: 1124252, url: "https://github.com/advisories/GHSA-6g55-p6wh-862q", title: "File read" },
  { source: 1124288, url: "https://github.com/advisories/GHSA-r28c-9q8g-f849", title: "Traversal" },
  {
    source: 1130709,
    url: "https://github.com/advisories/GHSA-fxqj-rqcc-2cmp",
    title:
      "PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled " +
      "sourceMappingURL reads arbitrary .map files when `from` is unset",
  },
];

/** The findings this repository currently accepts. */
function acceptedResidualFixture() {
  return {
    next: { name: "next", severity: "high", via: ["postcss", "sharp"], nodes: ["node_modules/next"] },
    postcss: {
      name: "postcss",
      severity: "high",
      via: postcssAdvisories,
      nodes: ["node_modules/postcss"],
    },
    sharp: {
      name: "sharp",
      severity: "high",
      via: [
        { source: 1124066, url: "https://github.com/advisories/GHSA-f88m-g3jw-g9cj", title: "libvips" },
      ],
      nodes: ["node_modules/sharp"],
    },
  };
}

test("current accepted residuals pass", () => {
  const { problems, accepted } = evaluate(acceptedResidualFixture(), { resolveVersion });

  assert.deepEqual(problems, []);
  // four postcss advisories + one sharp + the derived next entry
  assert.equal(accepted.length, 6);
});

// --- GHSA-fxqj-rqcc-2cmp (CVE-2026-69153), postcss <= 8.5.22 -----------------
// Accepted as unreachable: build-time-only PostCSS over first-party CSS. These
// cases pin the acceptance to one advisory, at one version, on one path.

const NEW_POSTCSS_ADVISORY = "GHSA-fxqj-rqcc-2cmp";

/** A fixture whose only postcss finding is the newly disclosed advisory. */
function newAdvisoryOnlyFixture() {
  const fixture = acceptedResidualFixture();
  fixture.postcss.via = postcssAdvisories.filter((advisory) =>
    advisory.url.includes(NEW_POSTCSS_ADVISORY),
  );
  return fixture;
}

test("the new PostCSS advisory passes at 8.4.31 on node_modules/postcss", () => {
  const { problems, accepted } = evaluate(newAdvisoryOnlyFixture(), { resolveVersion });

  assert.deepEqual(problems, []);
  assert.ok(
    accepted.some(
      (item) =>
        item.package === "postcss" &&
        item.advisory === NEW_POSTCSS_ADVISORY &&
        item.detail === "8.4.31 at node_modules/postcss",
    ),
    "expected the new advisory to be accepted at exactly 8.4.31/node_modules/postcss",
  );
});

test("the new PostCSS advisory fails at any other installed version", () => {
  // 8.5.23 is the patched release; even moving *toward* it must force a
  // re-review rather than silently reusing this acceptance.
  for (const drifted of ["8.4.32", "8.5.22", "8.5.23"]) {
    const { problems } = evaluate(newAdvisoryOnlyFixture(), {
      resolveVersion: (nodePath) =>
        nodePath === "node_modules/postcss" ? drifted : resolveVersion(nodePath),
    });

    assert.equal(problems.length, 1, `expected exactly one problem for ${drifted}`);
    assert.match(
      problems[0],
      new RegExp(`allowlisted for version 8\\.4\\.31 but ${drifted.replace(/\./g, "\\.")} is installed`),
    );
  }
});

test("the new PostCSS advisory fails at a different dependency path", () => {
  const fixture = newAdvisoryOnlyFixture();
  fixture.postcss.nodes = ["node_modules/next/node_modules/postcss"];

  const { problems } = evaluate(fixture, { resolveVersion });

  assert.equal(problems.length, 1);
  assert.match(problems[0], /expected dependency path "node_modules\/postcss"/);
  assert.match(problems[0], /node_modules\/next\/node_modules\/postcss/);
});

test("a different unknown PostCSS sourceMappingURL advisory still fails", () => {
  const fixture = acceptedResidualFixture();
  fixture.postcss.via = [
    ...postcssAdvisories,
    {
      source: 1130710,
      url: "https://github.com/advisories/GHSA-zzzz-zzzz-zzzz",
      title: "Yet another sourceMappingURL issue",
    },
  ];

  const { problems } = evaluate(fixture, { resolveVersion });

  assert.equal(problems.length, 1);
  assert.match(problems[0], /unaccepted advisory GHSA-zzzz-zzzz-zzzz/);
});

test("the acceptance is what makes the fixture pass — remove it and it fails", () => {
  // `ACCEPTED_FINDINGS` is a module constant that `evaluate` closes over, so the
  // register cannot be mutated from a test without changing the module's
  // contract. The equivalent proof is a counterfactual: an otherwise byte-identical
  // finding — same package, same 8.4.31, same node_modules/postcss — differing
  // only in carrying an advisory id the register does not list, must fail. The
  // companion assertion below pins that the real id *is* listed, so the
  // allowlist entry is the only thing separating these two outcomes.
  const entry = ACCEPTED_FINDINGS.find(
    (candidate) =>
      candidate.package === "postcss" && candidate.advisory === NEW_POSTCSS_ADVISORY,
  );
  assert.ok(entry, "GHSA-fxqj-rqcc-2cmp must be present in the allowlist");
  assert.equal(entry.version, "8.4.31");
  assert.equal(entry.path, "node_modules/postcss");
  assert.ok(entry.reason.length > 0, "an acceptance without a reason is not an acceptance");
  assert.ok(entry.invalidatedBy.length > 0);
  assert.ok(entry.removedBy.includes("8.5.23"));

  const unlisted = newAdvisoryOnlyFixture();
  unlisted.postcss.via = [
    { ...unlisted.postcss.via[0], url: "https://github.com/advisories/GHSA-fxqj-rqcc-2cmq" },
  ];

  const { problems } = evaluate(unlisted, { resolveVersion });

  assert.equal(problems.length, 1);
  assert.match(problems[0], /unaccepted advisory GHSA-fxqj-rqcc-2cmq/);
});

test("the allowlist grants no wildcard to postcss", () => {
  // Guards the shape of the register itself: acceptance is per-advisory, never
  // per-package, and never version- or path-agnostic.
  for (const entry of ACCEPTED_FINDINGS) {
    assert.match(entry.advisory, /^GHSA-[0-9a-z-]+$/, `${entry.package} has a non-GHSA advisory id`);
    assert.doesNotMatch(entry.advisory, /\*/);
    assert.match(entry.version, /^\d+\.\d+\.\d+$/, `${entry.package} ${entry.advisory} lacks an exact version`);
    assert.doesNotMatch(entry.path, /\*/);
  }

  const postcssEntries = ACCEPTED_FINDINGS.filter((entry) => entry.package === "postcss");
  assert.equal(postcssEntries.length, 4);
  assert.deepEqual(
    [...new Set(postcssEntries.map((entry) => entry.advisory))].sort(),
    [
      "GHSA-6g55-p6wh-862q",
      "GHSA-fxqj-rqcc-2cmp",
      "GHSA-qx2v-qp2m-jg93",
      "GHSA-r28c-9q8g-f849",
    ],
  );
});

test("a clean audit passes", () => {
  const { problems, accepted } = evaluate({}, { resolveVersion });

  assert.deepEqual(problems, []);
  assert.deepEqual(accepted, []);
});

test("an unknown advisory on an allowlisted package fails", () => {
  const fixture = acceptedResidualFixture();
  fixture.postcss.via = [
    ...postcssAdvisories,
    {
      source: 9999999,
      url: "https://github.com/advisories/GHSA-newl-yadv-isry",
      title: "Brand new PostCSS issue",
    },
  ];

  const { problems } = evaluate(fixture, { resolveVersion });

  assert.equal(problems.length, 1);
  assert.match(problems[0], /unaccepted advisory GHSA-newl-yadv-isry/);
});

test("an additional vulnerable package fails", () => {
  const fixture = acceptedResidualFixture();
  fixture.lodash = {
    name: "lodash",
    severity: "critical",
    via: [
      { source: 1234567, url: "https://github.com/advisories/GHSA-jf85-cpcp-j695", title: "Prototype pollution" },
    ],
    nodes: ["node_modules/lodash"],
  };

  const { problems } = evaluate(fixture, { resolveVersion });

  assert.equal(problems.length, 1);
  assert.match(problems[0], /^lodash: unaccepted advisory GHSA-jf85-cpcp-j695/);
});

test("a changed allowlisted package version fails", () => {
  const drifted = (nodePath) =>
    nodePath === "node_modules/sharp" ? "0.34.6" : resolveVersion(nodePath);

  const { problems } = evaluate(acceptedResidualFixture(), { resolveVersion: drifted });

  assert.equal(problems.length, 1);
  assert.match(problems[0], /allowlisted for version 0\.34\.5 but 0\.34\.6 is installed/);
});

test("a missing installed package fails rather than passing silently", () => {
  const missing = (nodePath) =>
    nodePath === "node_modules/postcss" ? null : resolveVersion(nodePath);

  const { problems } = evaluate(acceptedResidualFixture(), { resolveVersion: missing });

  assert.equal(problems.length, 4); // one per postcss advisory
  for (const problem of problems) {
    assert.match(problem, /could not read an installed version/);
  }
});

test("an allowlisted advisory reported at a different path fails", () => {
  const fixture = acceptedResidualFixture();
  fixture.sharp.nodes = ["node_modules/some-other-parent/node_modules/sharp"];

  const { problems } = evaluate(fixture, { resolveVersion });

  assert.equal(problems.length, 1);
  assert.match(problems[0], /expected dependency path "node_modules\/sharp"/);
});

test("a derived-only package deriving from something unaccepted fails", () => {
  const fixture = acceptedResidualFixture();
  fixture.next.via = ["postcss", "sharp", "some-new-vulnerable-dep"];

  const { problems } = evaluate(fixture, { resolveVersion });

  assert.equal(problems.length, 1);
  assert.match(problems[0], /derives from package\(s\) not in the allowlist: some-new-vulnerable-dep/);
});

test("an unknown package with no advisory of its own fails", () => {
  const { problems } = evaluate(
    { mystery: { name: "mystery", severity: "high", via: ["postcss"], nodes: [] } },
    { resolveVersion },
  );

  assert.equal(problems.length, 1);
  assert.match(problems[0], /not a known derived-only package/);
});

test("malformed JSON fails safely", () => {
  assert.throws(() => parseAuditReport("{not json"), AuditPolicyError);
  assert.throws(() => parseAuditReport("[]"), AuditPolicyError);
  assert.throws(
    () => parseAuditReport(JSON.stringify({ vulnerabilities: "nope" })),
    AuditPolicyError,
  );
});

test("an audit report with no vulnerabilities key is treated as clean", () => {
  assert.deepEqual(parseAuditReport(JSON.stringify({ auditReportVersion: 2 })), {});
});

test("development-only findings are outside this policy", () => {
  // `npm audit --omit=dev` is what the policy consumes, so dev-only packages
  // never appear in its input. This asserts the boundary explicitly: the
  // dev-only cluster under @capacitor/assets is absent from the production
  // fixture, and adding one would be treated as an unexpected finding.
  const productionPackages = Object.keys(acceptedResidualFixture());

  for (const devOnly of ["tar", "minimatch", "brace-expansion", "uuid", "@capacitor/assets"]) {
    assert.equal(productionPackages.includes(devOnly), false);
  }

  const { problems } = evaluate(
    {
      tar: {
        name: "tar",
        severity: "critical",
        via: [{ source: 1, url: "https://github.com/advisories/GHSA-34x7-hfp2-rc4v", title: "traversal" }],
        nodes: ["node_modules/@capacitor/assets/node_modules/tar"],
      },
    },
    { resolveVersion },
  );

  // If a dev-only finding ever did surface in production scope, it fails.
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^tar: unaccepted advisory/);
});
