import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const billingModule = await import(
  pathToFileURL(
    resolve(import.meta.dirname, "..", "src", "native", "billing.ts"),
  ).href
);

function iosPurchases({ error } = {}) {
  return {
    getProducts: async ({ productIdentifiers, productType }) => {
      assert.equal(productType, "inapp");
      return {
        products: productIdentifiers.map((identifier) => ({
          identifier,
          title: identifier,
          description: "",
          price: 4.99,
          priceString: "SAR 4.99",
          currencyCode: "SAR",
          currencySymbol: "SAR",
          isFamilyShareable: false,
          introductoryPrice: null,
          discounts: [],
        })),
      };
    },
    purchaseProduct: async (options) => {
      assert.deepEqual(options, {
        productIdentifier: "ai.smartexpense.support.medium",
        productType: "inapp",
        appAccountToken: "1b749a4b-fbbd-45ae-a09e-b96be60b12dd",
        isConsumable: false,
        autoAcknowledgePurchases: false,
      });
      if (error) throw error;
      return {
        transactionId: "2000001043762129",
        productIdentifier: "ai.smartexpense.support.medium",
        purchaseDate: "2026-07-26T10:00:00Z",
        willCancel: null,
      };
    },
    getPurchases: async () => ({ purchases: [] }),
    consumePurchase: async () => {
      assert.fail("iOS StoreKit transactions are finished, not Play-consumed.");
    },
    acknowledgePurchase: async ({ purchaseToken }) => {
      assert.equal(purchaseToken, "2000001043762129");
    },
  };
}

test("iOS sends only the StoreKit transaction id and finishes it after backend completion", async () => {
  const bridge = billingModule.createSupportBillingBridge({
    platform: () => "ios",
    purchases: iosPurchases(),
  });

  let verified = false;
  const result = await bridge.purchase({
    tier_id: "support_medium",
    account_id: "1b749a4b-fbbd-45ae-a09e-b96be60b12dd",
    verify: async (request) => {
      verified = true;
      assert.deepEqual(request, {
        tier_id: "support_medium",
        channel: "apple",
        provider_transaction_id: "2000001043762129",
      });
      return {
        id: "purchase-ios",
        tier_id: "support_medium",
        channel: "ios",
        amount_minor_units: 1499,
        currency: "SAR",
        status: "completed",
        failure_reason: null,
        created_at: "2026-07-26T10:00:00Z",
        updated_at: "2026-07-26T10:00:01Z",
        provider_reference: "2000001043762129",
      };
    },
  });

  assert.equal(verified, true);
  assert.equal(result.status, "completed");
  assert.equal(result.purchase?.channel, "ios");
});

test("iOS cancellation returns a typed failed result without calling verification", async () => {
  const bridge = billingModule.createSupportBillingBridge({
    platform: () => "ios",
    purchases: iosPurchases({ error: new Error("User cancelled the purchase") }),
  });
  let verified = false;

  const result = await bridge.purchase({
    tier_id: "support_medium",
    account_id: "1b749a4b-fbbd-45ae-a09e-b96be60b12dd",
    verify: async () => {
      verified = true;
      throw new Error("Cancellation must not call the backend.");
    },
  });

  assert.deepEqual(result, { status: "failed", reason: "cancelled" });
  assert.equal(verified, false);
});

test("iOS bridge reads the shared receipt contract and opens only an official HTTPS URL", async () => {
  const opened = [];
  const bridge = billingModule.createSupportBillingBridge({
    platform: () => "ios",
    purchases: iosPurchases(),
    openExternal: async (url) => {
      opened.push(url);
    },
  });
  const receipt = await bridge.getReceipt(
    "purchase-ios",
    async (purchaseId) => ({
      id: purchaseId,
      tier_id: "support_medium",
      channel: "ios",
      amount_minor_units: 1500,
      currency: "SAR",
      status: "completed",
      created_at: "2026-07-26T10:00:00Z",
      provider_reference: "2000001043762129",
      provider_receipt_url: "https://reportaproblem.apple.com/receipt/test",
      signed_payload: "private-apple-jws",
    }),
  );

  assert.deepEqual(receipt, {
    id: "purchase-ios",
    tier_id: "support_medium",
    channel: "ios",
    amount_minor_units: 1500,
    currency: "SAR",
    status: "completed",
    created_at: "2026-07-26T10:00:00Z",
    provider_reference: "2000001043762129",
    provider_receipt_url: "https://reportaproblem.apple.com/receipt/test",
  });
  assert.doesNotMatch(JSON.stringify(receipt), /private-apple-jws|signed_payload/);
  assert.equal(
    await bridge.openReceipt(
      "https://reportaproblem.apple.com/receipt/test",
    ),
    true,
  );
  assert.equal(await bridge.openReceipt("http://reportaproblem.apple.com"), false);
  assert.deepEqual(opened, [
    "https://reportaproblem.apple.com/receipt/test",
  ]);
});

test("iOS native project includes the StoreKit Capacitor plugin", async () => {
  const packageFile = await readFile(
    resolve(import.meta.dirname, "..", "ios", "App", "CapApp-SPM", "Package.swift"),
    "utf8",
  );
  assert.match(packageFile, /CapgoNativePurchases/);
  assert.match(packageFile, /@capgo[\\/]native-purchases/);
});
