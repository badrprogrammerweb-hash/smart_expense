import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const mobileRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(mobileRoot, "..", "..");
const webRoot = resolve(repositoryRoot, "apps", "web");

test("mobile support flow has no payment-card field or hosted checkout fallback inside Capacitor", async () => {
  const files = [
    resolve(mobileRoot, "src", "native", "billing.ts"),
    resolve(mobileRoot, "src", "native", "bootstrap.ts"),
    resolve(webRoot, "components", "settings", "SupportTierSelector.tsx"),
    resolve(webRoot, "lib", "platform", "capacitor.ts"),
  ];
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join(
    "\n",
  );

  assert.doesNotMatch(source, /autocomplete\s*=\s*["']cc-/i);
  assert.doesNotMatch(
    source,
    /name\s*=\s*["'](?:card[_-]?number|cvc|cvv|security[_-]?code|expir(?:y|ation))["']/i,
  );
  assert.doesNotMatch(
    source,
    /label\s*=\s*["'](?:card number|cvc|cvv|security code|expiry date)["']/i,
  );
  assert.match(source, /NativePurchases\.purchaseProduct|purchaseProduct/);
  assert.match(source, /isNative\(\).*nativeSupportBilling/s);
});
