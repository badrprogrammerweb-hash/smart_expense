import { Capacitor } from "@capacitor/core";
import {
  NativePurchases,
  PURCHASE_TYPE,
  type NativePurchasesPlugin,
  type Product,
  type Transaction,
} from "@capgo/native-purchases";

export type SupportTierId =
  | "support_small"
  | "support_medium"
  | "support_large";

export type NativeSupportTier = {
  tier_id: SupportTierId;
  label: string;
  display_amount: string;
  currency: string;
};

export type MobileVerifyRequest = {
  tier_id: SupportTierId;
  channel: "apple" | "google";
  provider_transaction_id: string;
};

export type VerifiedSupportPurchase = {
  id: string;
  tier_id: string;
  channel: "web" | "ios" | "android";
  amount_minor_units: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  provider_reference: string | null;
};

export type SupportBillingResult =
  | {
      status: "pending";
      purchase?: VerifiedSupportPurchase;
      reason?: "store-pending";
    }
  | { status: "completed"; purchase: VerifiedSupportPurchase }
  | {
      status: "failed";
      purchase?: VerifiedSupportPurchase;
      reason:
        | "cancelled"
        | "refunded"
        | "unavailable"
        | "invalid-transaction"
        | "verification-failed";
    };

export type SupportBillingPurchaseInput = {
  tier_id: SupportTierId;
  account_id: string;
  verify: (request: MobileVerifyRequest) => Promise<VerifiedSupportPurchase>;
};

type SupportBillingDependencies = {
  platform: () => string;
  purchases: Pick<
    NativePurchasesPlugin,
    | "getProducts"
    | "purchaseProduct"
    | "getPurchases"
    | "consumePurchase"
    | "acknowledgePurchase"
  >;
};

const PRODUCT_IDS: Record<
  SupportTierId,
  { ios: string; android: string }
> = {
  support_small: {
    ios: "ai.smartexpense.support.small",
    android: "ai.smartexpense.support.small",
  },
  support_medium: {
    ios: "ai.smartexpense.support.medium",
    android: "ai.smartexpense.support.medium",
  },
  support_large: {
    ios: "ai.smartexpense.support.large",
    android: "ai.smartexpense.support.large",
  },
};

function nativePlatform(value: string): "ios" | "android" | null {
  return value === "ios" || value === "android" ? value : null;
}

function productId(
  platform: "ios" | "android",
  tierId: SupportTierId,
): string {
  return PRODUCT_IDS[tierId][platform];
}

function validAccountId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function cancelled(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("cancelled") || message.includes("canceled");
}

function pending(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("pending");
}

function productByIdentifier(
  products: Product[],
  identifier: string,
): Product | undefined {
  return products.find((product) => product.identifier === identifier);
}

async function recoverAndroidPendingTransaction(
  purchases: SupportBillingDependencies["purchases"],
  {
    accountId,
    expectedProductId,
  }: {
    accountId: string;
    expectedProductId: string;
  },
): Promise<Transaction | null> {
  try {
    const result = await purchases.getPurchases({
      productType: PURCHASE_TYPE.INAPP,
      appAccountToken: accountId,
    });
    return (
      result.purchases.find(
        (purchase) =>
          purchase.productIdentifier === expectedProductId &&
          // "1" is Google Play's PURCHASED state; "0" means still pending.
          // We are checking whether the earlier "pending" purchase attempt
          // has since resolved, so we must look for the completed state,
          // not repeat the same pending check.
          purchase.purchaseState === "1" &&
          typeof purchase.purchaseToken === "string",
      ) ?? null
    );
  } catch {
    return null;
  }
}

export function createSupportBillingBridge({
  platform,
  purchases,
}: SupportBillingDependencies) {
  return {
    async listTiers(tiers: NativeSupportTier[]): Promise<NativeSupportTier[]> {
      const currentPlatform = nativePlatform(platform());
      if (currentPlatform === null) {
        // The native bootstrap is not injected into a browser build, but this
        // fallback keeps direct module tests and accidental web imports safe.
        return tiers;
      }
      const identifiers = tiers.map((tier) =>
        productId(currentPlatform, tier.tier_id),
      );
      const response = await purchases.getProducts({
        productIdentifiers: identifiers,
        productType: PURCHASE_TYPE.INAPP,
      });
      return tiers.map((tier) => {
        const product = productByIdentifier(
          response.products,
          productId(currentPlatform, tier.tier_id),
        );
        if (!product) {
          throw new Error("A configured support product is unavailable.");
        }
        return {
          ...tier,
          display_amount: product.priceString,
          currency: product.currencyCode,
        };
      });
    },

    async purchase(
      input: SupportBillingPurchaseInput,
    ): Promise<SupportBillingResult> {
      const currentPlatform = nativePlatform(platform());
      if (
        currentPlatform === null ||
        !PRODUCT_IDS[input.tier_id] ||
        !validAccountId(input.account_id)
      ) {
        return { status: "failed", reason: "unavailable" };
      }
      const expectedProductId = productId(currentPlatform, input.tier_id);

      let transaction: Transaction;
      try {
        transaction = await purchases.purchaseProduct({
          productIdentifier: expectedProductId,
          productType: PURCHASE_TYPE.INAPP,
          appAccountToken: input.account_id,
          // Support products are repeatable consumables. Automatic
          // consumption would race backend verification, so finish/consume
          // only after the backend returns provider-verified completion.
          isConsumable: false,
          autoAcknowledgePurchases: false,
        });
      } catch (error) {
        if (cancelled(error)) {
          return { status: "failed", reason: "cancelled" };
        }
        if (currentPlatform === "android" && pending(error)) {
          const recovered = await recoverAndroidPendingTransaction(
            purchases,
            {
              accountId: input.account_id,
              expectedProductId,
            },
          );
          if (recovered === null) {
            return { status: "pending", reason: "store-pending" };
          }
          transaction = recovered;
        } else {
          return { status: "failed", reason: "unavailable" };
        }
      }

      if (transaction.productIdentifier !== expectedProductId) {
        return { status: "failed", reason: "invalid-transaction" };
      }
      const providerTransactionId =
        currentPlatform === "ios"
          ? transaction.transactionId
          : transaction.purchaseToken;
      if (!providerTransactionId) {
        return { status: "failed", reason: "invalid-transaction" };
      }

      let verified: VerifiedSupportPurchase;
      try {
        verified = await input.verify({
          tier_id: input.tier_id,
          channel: currentPlatform === "ios" ? "apple" : "google",
          provider_transaction_id: providerTransactionId,
        });
      } catch {
        return { status: "failed", reason: "verification-failed" };
      }

      if (verified.status === "pending") {
        return { status: "pending", purchase: verified };
      }
      if (verified.status === "failed") {
        return {
          status: "failed",
          purchase: verified,
          reason: "verification-failed",
        };
      }
      if (verified.status === "refunded") {
        return { status: "failed", purchase: verified, reason: "refunded" };
      }

      try {
        if (currentPlatform === "android") {
          await purchases.consumePurchase({
            purchaseToken: providerTransactionId,
          });
        } else {
          await purchases.acknowledgePurchase({
            purchaseToken: providerTransactionId,
          });
        }
      } catch {
        // Backend verification is authoritative. StoreKit/Play will redeliver
        // an unfinished transaction so the bridge can safely retry finishing
        // it later without changing the completed backend state.
      }
      return { status: "completed", purchase: verified };
    },
  };
}

export const supportBilling = createSupportBillingBridge({
  platform: () => Capacitor.getPlatform(),
  purchases: NativePurchases,
});
