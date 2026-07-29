import { describe, expect, it } from "vitest";

import {
  SUPPORT_TRANSLATION_KEY,
  assertSupportCopyCompliant,
  collectLocaleSupportTargets,
  findProhibitedSupportCopy,
  scanConfiguredSupportCopy,
} from "../../scripts/check-support-purchase-copy.mjs";


// The Arabic terms below are charitable/fundraising wording that must never
// reach translations or any UI surface. They exist here solely as fixtures
// proving the lint rejects them (FR-002, SC-007).
const TABARRU = "تبرع"; // "donate"/"donation"
const TABARRU_SHADDA = "تبرّع"; // same word, shadda-vocalized
const TABARRUAT = "تبرعات"; // "donations"
const SADAQA = "صدقة"; // "charity"/"alms"
const SADAQAT = "صدقات"; // "charities"
const KHAYRI = "خيري"; // "charitable"
const KHAYRIYYA = "خيرية"; // "charitable" (feminine)
const AL_TABARRU = `ال${TABARRU}`; // definite-article prefixed
const YATABARRA = `ي${TABARRU}`; // verb form

describe("support-purchase copy lint: prohibited wording", () => {
  it.each([
    "donate",
    "donated",
    "donates",
    "donating",
    "donation",
    "donations",
    "donor",
    "donors",
    "charity",
    "CHARITABLE",
    "fundraising",
    "Fund-Raising",
    "fund raising",
  ])("rejects prohibited English wording: %s", (term) => {
    const copy = `Please ${term} today.`;

    expect(findProhibitedSupportCopy(copy, "fixture")).toEqual([
      expect.objectContaining({ source: "fixture", term }),
    ]);
    expect(() => assertSupportCopyCompliant(copy, "fixture")).toThrow(
      /prohibited support-purchase wording/u,
    );
  });

  // Arabic must be matched without `\b`: JavaScript word boundaries are
  // defined on ASCII word characters even under the `u` flag, so a
  // `\b`-wrapped Arabic term could never match.
  it.each([
    [TABARRU, TABARRU],
    [TABARRU_SHADDA, TABARRU_SHADDA],
    [TABARRUAT, TABARRUAT],
    [SADAQA, SADAQA],
    [SADAQAT, SADAQAT],
    [KHAYRI, KHAYRI],
    [KHAYRIYYA, KHAYRIYYA],
    // Arabic clitics attach directly to the word, so prefixed and inflected
    // forms must still be caught.
    [AL_TABARRU, TABARRU],
    [YATABARRA, TABARRU],
  ])("rejects prohibited Arabic wording: %s", (term, expectedMatch) => {
    const copy = `النص ${term} النص`;

    expect(findProhibitedSupportCopy(copy, "fixture")).toEqual([
      expect.objectContaining({ source: "fixture", term: expectedMatch }),
    ]);
    expect(() => assertSupportCopyCompliant(copy, "fixture")).toThrow(
      /prohibited support-purchase wording/u,
    );
  });
});

describe("support-purchase copy lint: approved wording", () => {
  it.each([
    "Support the product",
    "Make an optional support purchase",
    "Your support purchase is pending",
    "Product support is always optional",
    "Send a thank-you",
    "Choose a thank-you symbol",
    "Choose a support tier",
  ])("allows approved English support wording: %s", (copy) => {
    expect(findProhibitedSupportCopy(copy, "fixture")).toEqual([]);
    expect(() => assertSupportCopyCompliant(copy, "fixture")).not.toThrow();
  });

  it.each([
    "دعم المنتج",
    "عملية دعم",
    "أرسل شكرًا",
    "رمز تقدير",
    "باقة دعم",
    "شراء رمز دعم",
    // "verification" shares the ص-د-ق root but is not the prohibited noun.
    "التصديق",
    "مسترد",
  ])("allows approved Arabic support wording: %s", (copy) => {
    expect(findProhibitedSupportCopy(copy, "fixture")).toEqual([]);
    expect(() => assertSupportCopyCompliant(copy, "fixture")).not.toThrow();
  });

  // Refund wording is core support-purchase vocabulary and shares letters with
  // "fundraising"/"donation"; a false positive here would block real copy.
  it.each([
    "refund",
    "refunded",
    "refunds",
    "This support purchase was refunded and refunds change no access",
    "The provider refunded this purchase",
    "fund",
    "funds",
    "abandon",
    "done",
    "London",
  ])("allows refund and other non-charitable wording: %s", (copy) => {
    expect(findProhibitedSupportCopy(copy, "fixture")).toEqual([]);
    expect(() => assertSupportCopyCompliant(copy, "fixture")).not.toThrow();
  });
});

describe("support-purchase copy lint: configured production scope", () => {
  const EN_SUBTREE = `apps/web/messages/en.json#${SUPPORT_TRANSLATION_KEY}`;
  const AR_SUBTREE = `apps/web/messages/ar.json#${SUPPORT_TRANSLATION_KEY}`;
  const REQUIRED_FILES = [
    "apps/api/app/core/support_tiers.py",
    "apps/api/app/routes/support_purchases.py",
    "apps/api/app/schemas/support_purchases.py",
    "apps/mobile/src/native/billing.ts",
    "apps/web/app/[locale]/(app)/settings/support/page.tsx",
    "apps/web/app/[locale]/(app)/settings/support/result/page.tsx",
    "apps/web/components/settings/SupportPurchaseCard.tsx",
    "apps/web/components/settings/SupportPurchaseHistory.tsx",
    "apps/web/components/settings/SupportPurchaseResult.tsx",
    "apps/web/components/settings/SupportReceiptView.tsx",
    "apps/web/components/settings/SupportTierSelector.tsx",
  ];

  it("scans both locale subtrees, the web UI, the native bridge, and the backend", async () => {
    const result = await scanConfiguredSupportCopy();

    // Source labels are normalized to forward slashes by the scanner, so these
    // assertions hold identically on Windows and Linux runners.
    const englishStrings = result.sources.filter((source) =>
      source.startsWith(`${EN_SUBTREE}.`),
    );
    const arabicStrings = result.sources.filter((source) =>
      source.startsWith(`${AR_SUBTREE}.`),
    );

    expect(englishStrings.length).toBeGreaterThanOrEqual(40);
    expect(arabicStrings.length).toBeGreaterThanOrEqual(40);
    // Both locales must contribute the same set of translated keys.
    expect(arabicStrings.length).toBe(englishStrings.length);

    for (const file of REQUIRED_FILES) {
      expect(result.sources).toContain(file);
    }

    const fileTargets = result.sources.filter(
      (source) => !source.includes("#"),
    );
    expect(fileTargets.length).toBeGreaterThanOrEqual(REQUIRED_FILES.length);
    expect(result.scannedTargets).toBe(result.sources.length);
    expect(result.scannedTargets).toBeGreaterThanOrEqual(100);
  });

  it("reports no prohibited wording in the current production copy", async () => {
    const result = await scanConfiguredSupportCopy();

    expect(result.issues).toEqual([]);
  });

  it("never scans tests, snapshots, or type declarations", async () => {
    const result = await scanConfiguredSupportCopy();

    expect(
      result.sources.filter((source) =>
        /__tests__|__snapshots__|\.test\.|\.spec\.|\.d\.ts$|\.snap$|node_modules/u.test(
          source,
        ),
      ),
    ).toEqual([]);
  });

  it.each([
    ["a missing subtree", {}],
    ["a renamed subtree", { supportPurchasesLegacy: { title: "Support" } }],
    ["a non-object subtree", { [SUPPORT_TRANSLATION_KEY]: "Support" }],
    ["a non-object locale file", null],
  ])("fails closed on %s instead of silently skipping it", (_label, parsed) => {
    expect(() =>
      collectLocaleSupportTargets(parsed, "apps/web/messages/xx.json"),
    ).toThrow(/apps\/web\/messages\/xx\.json/u);
  });

  it("fails closed when a locale subtree contains no strings", () => {
    expect(() =>
      collectLocaleSupportTargets(
        { [SUPPORT_TRANSLATION_KEY]: {} },
        "apps/web/messages/xx.json",
      ),
    ).toThrow(/resolved no translated strings/u);
  });
});
