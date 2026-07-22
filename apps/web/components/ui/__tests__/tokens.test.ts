import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const tokenNames = [
  "--color-income",
  "--color-income-foreground",
  "--color-income-subtle",
  "--color-income-border",
  "--color-expense",
  "--color-expense-foreground",
  "--color-expense-subtle",
  "--color-expense-border",
  "--color-pending",
  "--color-pending-foreground",
  "--color-pending-subtle",
  "--color-pending-border",
  "--color-info",
  "--color-info-foreground",
  "--color-info-subtle",
  "--color-info-border",
  "--color-primary-hover",
  "--color-surface-hover",
  "--radius-control",
  "--radius-card",
  "--radius-pill",
  "--shadow-card",
  "--shadow-dialog",
  "--shadow-focus",
  "--spacing-1",
  "--spacing-2",
  "--spacing-3",
  "--spacing-4",
  "--spacing-6",
  "--spacing-8",
  "--spacing-12",
  "--numeric-feature",
];

describe("design tokens", () => {
  it("defines the required custom properties on :root", () => {
    const stylesheet = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const root = stylesheet.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

    for (const tokenName of tokenNames) {
      expect(root, tokenName).toMatch(new RegExp(`${tokenName}:\\s*[^;]+;`));
    }
  });
});
