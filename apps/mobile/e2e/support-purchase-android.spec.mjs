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

const tiers = [
  {
    tier_id: "support_small",
    label: "Small support",
    display_amount: "5.00",
    currency: "SAR",
  },
  {
    tier_id: "support_medium",
    label: "Medium support",
    display_amount: "15.00",
    currency: "SAR",
  },
  {
    tier_id: "support_large",
    label: "Large support",
    display_amount: "50.00",
    currency: "SAR",
  },
];

function androidPurchases(transaction) {
  return {
    getProducts: async ({ productIdentifiers, productType }) => {
      assert.deepEqual(productIdentifiers, [
        "ai.smartexpense.support.small",
        "ai.smartexpense.support.medium",
        "ai.smartexpense.support.large",
      ]);
      assert.equal(productType, "inapp");
      return {
        products: productIdentifiers.map((identifier, index) => ({
          identifier,
          title: tiers[index].label,
          description: "",
          price: [5.99, 15.99, 49.99][index],
          priceString: ["SAR 5.99", "SAR 15.99", "SAR 49.99"][index],
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
        productIdentifier: "ai.smartexpense.support.small",
        productType: "inapp",
        appAccountToken: "b57eccea-2f0a-4143-92cd-e0b1524d237f",
        isConsumable: false,
        autoAcknowledgePurchases: false,
      });
      return transaction;
    },
    getPurchases: async () => ({ purchases: [] }),
    consumePurchase: async ({ purchaseToken }) => {
      assert.equal(purchaseToken, "secret-google-purchase-token");
    },
    acknowledgePurchase: async () => {
      assert.fail("Android support purchases are consumed after verification.");
    },
  };
}

test("Android lists localized preset products and completes only after backend verification", async () => {
  const bridge = billingModule.createSupportBillingBridge({
    platform: () => "android",
    purchases: androidPurchases({
      transactionId: "GPA.1234-5678-9012-34567",
      productIdentifier: "ai.smartexpense.support.small",
      purchaseDate: "2026-07-26T10:00:00Z",
      purchaseToken: "secret-google-purchase-token",
      purchaseState: "1",
      willCancel: null,
    }),
  });

  const localized = await bridge.listTiers(tiers);
  assert.equal(localized[0].display_amount, "SAR 5.99");
  assert.equal(localized[0].currency, "SAR");

  let verified = false;
  const result = await bridge.purchase({
    tier_id: "support_small",
    account_id: "b57eccea-2f0a-4143-92cd-e0b1524d237f",
    verify: async (request) => {
      verified = true;
      assert.deepEqual(request, {
        tier_id: "support_small",
        channel: "google",
        provider_transaction_id: "secret-google-purchase-token",
      });
      return {
        id: "purchase-android",
        tier_id: "support_small",
        channel: "android",
        amount_minor_units: 599,
        currency: "SAR",
        status: "completed",
        failure_reason: null,
        created_at: "2026-07-26T10:00:00Z",
        updated_at: "2026-07-26T10:00:01Z",
        provider_reference: null,
      };
    },
  });

  assert.equal(verified, true);
  assert.equal(result.status, "completed");
  assert.equal(result.purchase?.id, "purchase-android");
  assert.doesNotMatch(JSON.stringify(result), /secret-google-purchase-token/);
});

test("Android keeps a server-reported pending purchase pending and does not consume it", async () => {
  let consumed = false;
  const purchases = androidPurchases({
    transactionId: "GPA.1234-5678-9012-34567",
    productIdentifier: "ai.smartexpense.support.small",
    purchaseDate: "2026-07-26T10:00:00Z",
    purchaseToken: "secret-google-purchase-token",
    purchaseState: "1",
    willCancel: null,
  });
  purchases.consumePurchase = async () => {
    consumed = true;
  };
  const bridge = billingModule.createSupportBillingBridge({
    platform: () => "android",
    purchases,
  });

  const result = await bridge.purchase({
    tier_id: "support_small",
    account_id: "b57eccea-2f0a-4143-92cd-e0b1524d237f",
    verify: async () => ({
      id: "purchase-pending",
      tier_id: "support_small",
      channel: "android",
      amount_minor_units: 599,
      currency: "SAR",
      status: "pending",
      failure_reason: null,
      created_at: "2026-07-26T10:00:00Z",
      updated_at: "2026-07-26T10:00:00Z",
      provider_reference: null,
    }),
  });

  assert.equal(result.status, "pending");
  assert.equal(consumed, false);
});

test("Android recovers a purchase that completed after an initial pending response", async () => {
  const purchases = androidPurchases({
    transactionId: "GPA.1234-5678-9012-34567",
    productIdentifier: "ai.smartexpense.support.small",
    purchaseDate: "2026-07-26T10:00:00Z",
    purchaseToken: "secret-google-purchase-token",
    purchaseState: "1",
    willCancel: null,
  });
  purchases.purchaseProduct = async () => {
    throw new Error("Purchase is pending.");
  };
  purchases.getPurchases = async ({ appAccountToken }) => {
    assert.equal(appAccountToken, "b57eccea-2f0a-4143-92cd-e0b1524d237f");
    return {
      purchases: [
        // A still-pending entry for a different product must be ignored...
        {
          transactionId: "GPA.other",
          productIdentifier: "ai.smartexpense.support.medium",
          purchaseToken: "other-token",
          purchaseState: "0",
        },
        // ...and the completed ("1") entry for the requested product must
        // be the one recovered and passed on to backend verification.
        {
          transactionId: "GPA.1234-5678-9012-34567",
          productIdentifier: "ai.smartexpense.support.small",
          purchaseToken: "secret-google-purchase-token",
          purchaseState: "1",
        },
      ],
    };
  };

  const bridge = billingModule.createSupportBillingBridge({
    platform: () => "android",
    purchases,
  });

  let verifiedToken = null;
  const result = await bridge.purchase({
    tier_id: "support_small",
    account_id: "b57eccea-2f0a-4143-92cd-e0b1524d237f",
    verify: async (request) => {
      verifiedToken = request.provider_transaction_id;
      return {
        id: "purchase-recovered",
        tier_id: "support_small",
        channel: "android",
        amount_minor_units: 599,
        currency: "SAR",
        status: "completed",
        failure_reason: null,
        created_at: "2026-07-26T10:00:00Z",
        updated_at: "2026-07-26T10:00:01Z",
        provider_reference: null,
      };
    },
  });

  assert.equal(verifiedToken, "secret-google-purchase-token");
  assert.equal(result.status, "completed");
});

test("Android reports store-pending when no completed purchase can be recovered yet", async () => {
  const purchases = androidPurchases({
    transactionId: "GPA.1234-5678-9012-34567",
    productIdentifier: "ai.smartexpense.support.small",
    purchaseDate: "2026-07-26T10:00:00Z",
    purchaseToken: "secret-google-purchase-token",
    purchaseState: "1",
    willCancel: null,
  });
  purchases.purchaseProduct = async () => {
    throw new Error("Purchase is pending.");
  };
  purchases.getPurchases = async () => ({
    purchases: [
      {
        transactionId: "GPA.1234-5678-9012-34567",
        productIdentifier: "ai.smartexpense.support.small",
        purchaseToken: "secret-google-purchase-token",
        purchaseState: "0",
      },
    ],
  });
  let verifyCalled = false;
  purchases.consumePurchase = async () => {
    assert.fail("A still-pending purchase must never be consumed.");
  };

  const bridge = billingModule.createSupportBillingBridge({
    platform: () => "android",
    purchases,
  });

  const result = await bridge.purchase({
    tier_id: "support_small",
    account_id: "b57eccea-2f0a-4143-92cd-e0b1524d237f",
    verify: async () => {
      verifyCalled = true;
      throw new Error("Backend verification must not be called while still pending.");
    },
  });

  assert.equal(result.status, "pending");
  assert.equal(result.reason, "store-pending");
  assert.equal(verifyCalled, false);
});

test("Android native project includes the Play Billing Capacitor plugin", async () => {
  const [settings, dependencies] = await Promise.all([
    readFile(resolve(import.meta.dirname, "..", "android", "capacitor.settings.gradle"), "utf8"),
    readFile(resolve(import.meta.dirname, "..", "android", "app", "capacitor.build.gradle"), "utf8"),
  ]);
  assert.match(settings, /capgo-native-purchases/);
  assert.match(dependencies, /implementation project\(':capgo-native-purchases'\)/);
});
