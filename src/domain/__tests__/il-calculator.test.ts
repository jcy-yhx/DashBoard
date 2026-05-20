import { describe, it, expect } from "vitest";
import { calculateV2Il, calculateIlEstimate } from "@/domain/services/il-calculator";

describe("calculateV2Il", () => {
  it("returns 0 when price ratio is 1 (no change)", () => {
    expect(calculateV2Il(1)).toBe(0);
  });

  it("returns negative for 2x price change", () => {
    // 2x change: IL ≈ -5.7%
    const il = calculateV2Il(2);
    expect(il).toBeLessThan(0);
    expect(il).toBeCloseTo(-0.057, 1);
  });

  it("returns negative for 0.5x price change (same as 2x)", () => {
    // IL is symmetric around 1
    expect(calculateV2Il(0.5)).toBeCloseTo(calculateV2Il(2), 2);
  });
});

describe("calculateIlEstimate", () => {
  it("returns zero IL when entry == current", () => {
    const result = calculateIlEstimate(1, 3500, 3500, 1, 1, 3500, false);
    // Current value equals hold value → zero IL
    // Actually with different amounts it won't be exactly 0
    // Let me test with same amounts
    const same = calculateIlEstimate(1, 3500, 3500, 1, 1, 3500, false);
    expect(same.ilPercent).toBe(0);
  });

  it("flags out-of-range position", () => {
    const result = calculateIlEstimate(1, 3500, 3500, 1, 1, 3500, true);
    expect(result.isOutOfRange).toBe(true);
  });
});
