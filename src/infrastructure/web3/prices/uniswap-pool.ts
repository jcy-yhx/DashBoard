import { type Address, type PublicClient, parseAbi } from "viem";
import type { IPriceAdapter } from "./interface";

const POOL_ABI = parseAbi([
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function token0Decimals() external view returns (uint8)",
  "function token1Decimals() external view returns (uint8)",
]);

const KNOWN_POOLS: Record<number, Record<string, string>> = {
  1: {
    // USDC/WETH 0.05% — use for WETH price in USD
    "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640_WETH":
      "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
    // USDC/WETH 0.3%
    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8_WETH":
      "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
  },
};

function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  token0Decimals: number,
  token1Decimals: number,
  token0IsStable: boolean,
): number {
  const priceRaw = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
  const decimalAdjust = 10 ** (token0Decimals - token1Decimals);
  const price = priceRaw * decimalAdjust;
  return token0IsStable ? price : 1 / price;
}

export class UniswapPoolPriceAdapter implements IPriceAdapter {
  readonly source = "uniswap-pool";

  constructor(private readonly client: PublicClient) {}

  async getPrice(tokenAddress: Address, chainId: number): Promise<number | null> {
    // Find a pool that contains this token
    const pools = KNOWN_POOLS[chainId];
    if (!pools) return null;

    for (const [key, poolAddress] of Object.entries(pools)) {
      if (!key.includes("WETH")) continue; // Only use WETH pairs for now

      try {
        const [slot0, token0, token1, t0Dec, t1Dec] = await this.client.multicall({
          contracts: [
            { address: poolAddress as Address, abi: POOL_ABI, functionName: "slot0" },
            { address: poolAddress as Address, abi: POOL_ABI, functionName: "token0" },
            { address: poolAddress as Address, abi: POOL_ABI, functionName: "token1" },
            { address: poolAddress as Address, abi: POOL_ABI, functionName: "token0Decimals" },
            { address: poolAddress as Address, abi: POOL_ABI, functionName: "token1Decimals" },
          ],
          allowFailure: false,
        });

        if (!slot0 || !token0 || !token1) continue;

        // multicall returns tuple, not named object
        const sqrtPriceX96 = (slot0 as readonly unknown[])[0] as bigint;
        const token0IsStable = (token0 as string).toLowerCase() !== tokenAddress.toLowerCase();
        const price = sqrtPriceX96ToPrice(
          sqrtPriceX96,
          Number(t0Dec),
          Number(t1Dec),
          token0IsStable,
        );

        // If we're pricing the non-WETH token, and token0 is WETH (not the stablecoin),
        // then price = token1/token0 in USD terms
        return price;
      } catch {
        continue;
      }
    }

    return null;
  }

  async getPrices(
    tokens: Array<{ address: Address; chainId: number }>,
  ): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    // Uniswap pool pricing is heavy — do sequentially
    for (const token of tokens) {
      const price = await this.getPrice(token.address, token.chainId);
      if (price !== null) {
        const key = `${token.chainId}:${token.address.toLowerCase()}`;
        priceMap.set(key, price);
      }
    }
    return priceMap;
  }
}
