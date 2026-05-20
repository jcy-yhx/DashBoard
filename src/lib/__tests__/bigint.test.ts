import { describe, it, expect } from "vitest";
import { fromTokenDecimals, toTokenDecimals, bigintToUsd } from "@/lib/bigint";

describe("fromTokenDecimals", () => {
  it("converts 18-decimal token correctly", () => {
    const result = fromTokenDecimals(1_500_000_000_000_000_000n, 18);
    expect(result).toBe("1.5");
  });

  it("converts 6-decimal token correctly", () => {
    const result = fromTokenDecimals(2_500_000n, 6);
    expect(result).toBe("2.5");
  });

  it("handles zero amount", () => {
    const result = fromTokenDecimals(0n, 18);
    expect(result).toBe("0");
  });

  it("handles small fractional amounts", () => {
    const result = fromTokenDecimals(100000n, 18);
    expect(result).toBe("0.0000000000001");
  });
});

describe("toTokenDecimals", () => {
  it("converts decimal string to bigint", () => {
    const result = toTokenDecimals("1.5", 18);
    expect(result).toBe(1_500_000_000_000_000_000n);
  });

  it("handles whole numbers", () => {
    const result = toTokenDecimals("10", 6);
    expect(result).toBe(10_000_000n);
  });

  it("handles 18-decimal precision", () => {
    const result = toTokenDecimals("0.000000000000000001", 18);
    expect(result).toBe(1n);
  });
});

describe("bigintToUsd", () => {
  it("computes correct USD value", () => {
    // 1 ETH = $3500
    const eth = 1_000_000_000_000_000_000n; // 1 ETH (18 decimals)
    const usd = bigintToUsd(eth, 18, 3500);
    expect(usd).toBeCloseTo(3500, 2);
  });

  it("handles zero balance", () => {
    const usd = bigintToUsd(0n, 18, 3500);
    expect(usd).toBe(0);
  });

  it("handles USDC (6 decimals)", () => {
    // 100 USDC at $1
    const usdc = 100_000_000n;
    const usd = bigintToUsd(usdc, 6, 1);
    expect(usd).toBeCloseTo(100, 2);
  });
});
