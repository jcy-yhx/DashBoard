import { describe, it, expect } from "vitest";
import { calculatePortfolio } from "@/domain/services/portfolio-calculator";
import type { TokenBalance, Token } from "@/domain/entities/token";
import type { ProtocolPosition } from "@/domain/entities/position";

const ETH: Token = {
  address: "0x0000000000000000000000000000000000000000",
  chainId: 1,
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
};

const USDC: Token = {
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  chainId: 1,
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
};

function makeBalance(token: Token, valueUsd: number): TokenBalance {
  return {
    token,
    balance: BigInt(valueUsd * 1e6),
    valueInUsd: valueUsd,
  };
}

function makePosition(
  protocolId: string,
  type: "lending" | "borrowing" | "lp" | "staking",
  tokens: Array<{ token: Token; valueUsd: number }>,
): ProtocolPosition {
  return {
    protocolId,
    chainId: 1,
    positionId: `${protocolId}-test-${type}`,
    type,
    underlyingTokens: tokens.map((t) => ({
      token: t.token,
      amount: BigInt(t.valueUsd * 1e6),
      valueInUsd: t.valueUsd,
    })),
  };
}

describe("calculatePortfolio", () => {
  it("returns zero total for empty input", () => {
    const p = calculatePortfolio("0x0", [], []);
    expect(p.totalUsd).toBe(0);
    expect(p.allocationByToken).toHaveLength(0);
    expect(p.allocationByProtocol).toHaveLength(0);
  });

  it("sums token-only portfolio correctly", () => {
    const balances = [
      makeBalance(ETH, 5000),
      makeBalance(USDC, 2000),
    ];
    const p = calculatePortfolio("0x1", balances, []);
    expect(p.totalUsd).toBe(7000);
    expect(p.allocationByToken).toHaveLength(2);
    expect(p.allocationByProtocol).toHaveLength(0);
  });

  it("correctly categorizes by protocol", () => {
    const positions = [
      makePosition("aave-v3", "lending", [{ token: ETH, valueUsd: 3000 }]),
      makePosition("aave-v3", "borrowing", [{ token: USDC, valueUsd: 500 }]),
      makePosition("lido", "staking", [{ token: ETH, valueUsd: 2000 }]),
    ];
    const p = calculatePortfolio("0x2", [], positions);

    const aave = p.allocationByProtocol.find((a) => a.protocolId === "aave-v3");
    const lido = p.allocationByProtocol.find((a) => a.protocolId === "lido");

    expect(aave!.valueUsd).toBe(3500); // 3000 + 500
    expect(lido!.valueUsd).toBe(2000);
  });

  it("computes correct percentages", () => {
    const balances = [
      makeBalance(ETH, 4000),
    ];
    const positions = [
      makePosition("lido", "staking", [{ token: ETH, valueUsd: 1000 }]),
    ];
    const p = calculatePortfolio("0x3", balances, positions);

    expect(p.totalUsd).toBe(5000);
    // Token allocation: 4000/5000 = 80% (wallet), positions aren't token allocation
    expect(p.allocationByToken[0]!.percentage).toBe(80);
    expect(p.allocationByProtocol[0]!.percentage).toBe(20);
  });

  it("handles null prices (excludes from total)", () => {
    const balances: TokenBalance[] = [{
      token: ETH,
      balance: 1_000_000_000_000_000_000n,
      valueInUsd: null,
    }];
    const p = calculatePortfolio("0x4", balances, []);
    expect(p.totalUsd).toBe(0);
  });
});
