import { describe, it, expect } from "vitest";
import { normalizeAllFeeExemptSetting } from "../lib/feeExempt";

describe("normalizeAllFeeExemptSetting", () => {
  it("accepts boolean and string values from app_settings", () => {
    expect(normalizeAllFeeExemptSetting(true)).toBe(true);
    expect(normalizeAllFeeExemptSetting("true")).toBe(true);
    expect(normalizeAllFeeExemptSetting("TRUE")).toBe(true);
    expect(normalizeAllFeeExemptSetting("false")).toBe(false);
    expect(normalizeAllFeeExemptSetting(undefined)).toBe(false);
  });
});
