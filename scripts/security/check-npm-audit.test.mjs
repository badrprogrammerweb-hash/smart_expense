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

const INSTALLED = {
  "node_modules/postcss": "8.4.31",
  "node_modules/sharp": "0.34.5",
};

const resolveVersion = (nodePath) => INSTALLED[nodePath] ?? null;

const postcssAdvisories = [
  { source: 1117015, url: "https://github.com/advisories/GHSA-qx2v-qp2m-jg93", title: "XSS" },
  { source: 1124252, url: "https://github.com/advisories/GHSA-6g55-p6wh-862q", title: "File read" },
  { source: 1124288, url: "https://github.com/advisories/GHSA-r28c-9q8g-f849", title: "Traversal" },
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
  // three postcss advisories + one sharp + the derived next entry
  assert.equal(accepted.length, 5);
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

  assert.equal(problems.length, 3); // one per postcss advisory
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
