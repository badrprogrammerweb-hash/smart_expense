import { describe, expect, it } from "vitest";

import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

describe("rate-limit message parity", () => {
  it("defines a non-empty errors.rateLimited message in English and Arabic", () => {
    expect(typeof enMessages.errors.rateLimited).toBe("string");
    expect(enMessages.errors.rateLimited.trim()).not.toBe("");
    expect(typeof arMessages.errors.rateLimited).toBe("string");
    expect(arMessages.errors.rateLimited.trim()).not.toBe("");
  });
});
