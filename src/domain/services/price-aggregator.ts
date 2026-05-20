import type { IPriceAdapter } from "@/infrastructure/web3/prices/interface";
import type { Address } from "viem";

export class PriceAggregator {
  private adapters: IPriceAdapter[] = [];

  constructor(adapters: IPriceAdapter[]) {
    this.adapters = adapters;
  }

  /**
   * Routes price lookup through adapters in registration order:
   * 1. Chainlink (on-chain, most reliable)
   * 2. Uniswap Pool (on-chain, for long-tail tokens)
   * 3. CoinGecko (off-chain, last resort)
   *
   * First non-null result wins.
   */
  async getPrice(tokenAddress: Address, chainId: number): Promise<number | null> {
    for (const adapter of this.adapters) {
      const price = await adapter.getPrice(tokenAddress, chainId);
      if (price !== null) return price;
    }
    return null;
  }

  /**
   * Batch price lookup. Groups tokens by adapter,
   * asks each adapter for the subset it supports.
   */
  async getPrices(
    tokens: Array<{ address: Address; chainId: number }>,
  ): Promise<Map<string, number>> {
    const allPrices = new Map<string, number>();
    const remaining = new Set(tokens.map((t) => `${t.chainId}:${t.address.toLowerCase()}`));
    const remainingTokens = [...tokens];

    for (const adapter of this.adapters) {
      if (remaining.size === 0) break;

      const adapterPrices = await adapter.getPrices(
        remainingTokens.map((t) => ({ address: t.address, chainId: t.chainId })),
      );

      for (const [key, price] of adapterPrices) {
        if (price !== null) {
          allPrices.set(key, price);
          remaining.delete(key);
        }
      }

      // Filter remaining tokens for next adapter
      if (remaining.size > 0) {
        remainingTokens.length = 0;
        remainingTokens.push(
          ...tokens.filter(
            (t) => remaining.has(`${t.chainId}:${t.address.toLowerCase()}`),
          ),
        );
      }
    }

    return allPrices;
  }
}
