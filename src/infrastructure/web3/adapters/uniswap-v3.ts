import { type Address, type PublicClient, parseAbi, erc20Abi } from "viem";
import { mainnet } from "viem/chains";
import type { IProtocolAdapter } from "./interface";
import type { ProtocolPosition, Token } from "@/domain/entities";

// Uniswap V3 NonfungiblePositionManager
const POSITION_MANAGER = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

const POSITION_MANAGER_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "positions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" },
    ],
  },
] as const;

const POOL_ABI = parseAbi([
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
]);

// Uniswap V3 Factory: compute pool address from (token0, token1, fee)
const UNISWAP_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const FACTORY_ABI = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address)",
]);

const KNOWN_TOKEN_INFO: Record<string, { symbol: string; name: string; decimals: number }> = {
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", name: "USD Coin", decimals: 6 },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", name: "Tether USD", decimals: 6 },
  "0x6b175474e89094c44da98b954eedeac495271d0f": { symbol: "DAI", name: "Dai Stablecoin", decimals: 18 },
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": { symbol: "WBTC", name: "Wrapped BTC", decimals: 8 },
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": { symbol: "UNI", name: "Uniswap", decimals: 18 },
  "0x514910771af9ca656af840dff83e8264ecf986ca": { symbol: "LINK", name: "Chainlink", decimals: 18 },
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": { symbol: "stETH", name: "Lido Staked ETH", decimals: 18 },
  "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0": { symbol: "wstETH", name: "Wrapped stETH", decimals: 18 },
};

function getTokenInfo(addr: string): { symbol: string; name: string; decimals: number } {
  const key = addr.toLowerCase();
  return KNOWN_TOKEN_INFO[key] ?? { symbol: "UNKNOWN", name: "Unknown Token", decimals: 18 };
}

// Uniswap V3 tick → price math
const TICK_BASE = 1.0001;

function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  return TICK_BASE ** tick * 10 ** (decimals0 - decimals1);
}

function sqrtPriceX96ToTick(sqrtPriceX96: bigint): number {
  const price = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
  return Math.floor(Math.log(price) / Math.log(TICK_BASE));
}

function getTokenAmounts(
  currentTick: number,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  decimals0: number,
  decimals1: number,
): { amount0: bigint; amount1: bigint } {
  const liq = Number(liquidity);

  if (currentTick <= tickLower) {
    // All token0
    const sqrtPL = Math.sqrt(TICK_BASE ** tickLower);
    const sqrtPU = Math.sqrt(TICK_BASE ** tickUpper);
    const amount0 = liq * (1 / sqrtPL - 1 / sqrtPU) * 10 ** decimals0;
    return { amount0: BigInt(Math.floor(amount0)), amount1: 0n };
  }

  if (currentTick >= tickUpper) {
    // All token1
    const sqrtPL = Math.sqrt(TICK_BASE ** tickLower);
    const sqrtPU = Math.sqrt(TICK_BASE ** tickUpper);
    const amount1 = liq * (sqrtPU - sqrtPL) * 10 ** decimals1;
    return { amount0: 0n, amount1: BigInt(Math.floor(amount1)) };
  }

  // In range — both tokens
  const sqrtPC = Math.sqrt(TICK_BASE ** currentTick);
  const sqrtPL = Math.sqrt(TICK_BASE ** tickLower);
  const sqrtPU = Math.sqrt(TICK_BASE ** tickUpper);

  const amount0 = liq * (1 / sqrtPC - 1 / sqrtPU) * 10 ** decimals0;
  const amount1 = liq * (sqrtPC - sqrtPL) * 10 ** decimals1;

  return {
    amount0: amount0 > 0 ? BigInt(Math.floor(amount0)) : 0n,
    amount1: amount1 > 0 ? BigInt(Math.floor(amount1)) : 0n,
  };
}

export class UniswapV3Adapter implements IProtocolAdapter {
  readonly protocolId = "uniswap-v3";
  readonly supportedChains = [mainnet.id];

  constructor(private readonly client: PublicClient) {}

  async getPositions(address: string, chainId: number): Promise<ProtocolPosition[]> {
    if (chainId !== mainnet.id) return [];

    try {
      // Step 1: How many NFT positions does the user have?
      const balance = await this.client.readContract({
        address: POSITION_MANAGER as Address,
        abi: POSITION_MANAGER_ABI,
        functionName: "balanceOf",
        args: [address as Address],
      });

      const count = Number(balance);
      if (count === 0) return [];

      // Step 2: Get all token IDs
      const tokenIds: bigint[] = [];
      for (let i = 0; i < count; i++) {
        const tokenId = await this.client.readContract({
          address: POSITION_MANAGER as Address,
          abi: POSITION_MANAGER_ABI,
          functionName: "tokenOfOwnerByIndex",
          args: [address as Address, BigInt(i)],
        });
        tokenIds.push(tokenId as bigint);
      }

      // Step 3: Get position details for all token IDs
      const positionCalls = tokenIds.map((tokenId) => ({
        address: POSITION_MANAGER as Address,
        abi: POSITION_MANAGER_ABI,
        functionName: "positions" as const,
        args: [tokenId],
      }));

      const positionResults = await this.client.multicall({
        contracts: positionCalls,
        allowFailure: true,
      });

      // Step 4: Deduplicate pools and fetch their slot0 + token info
      const poolKeys = new Map<string, { token0: string; token1: string; fee: number }>();
      const positions: Array<{
        tokenId: bigint;
        token0: string;
        token1: string;
        fee: number;
        tickLower: number;
        tickUpper: number;
        liquidity: bigint;
        tokensOwed0: bigint;
        tokensOwed1: bigint;
      }> = [];

      for (let i = 0; i < positionResults.length; i++) {
        const res = positionResults[i];
        if (!res || res.status !== "success") continue;

        const pos = res.result as unknown as {
          token0: string;
          token1: string;
          fee: number;
          tickLower: number;
          tickUpper: number;
          liquidity: bigint;
          tokensOwed0: bigint;
          tokensOwed1: bigint;
        };

        const poolKey = `${pos.token0.toLowerCase()}_${pos.token1.toLowerCase()}_${pos.fee}`;
        poolKeys.set(poolKey, { token0: pos.token0, token1: pos.token1, fee: pos.fee });

        positions.push({
          tokenId: tokenIds[i]!,
          token0: pos.token0,
          token1: pos.token1,
          fee: pos.fee,
          tickLower: pos.tickLower,
          tickUpper: pos.tickUpper,
          liquidity: pos.liquidity,
          tokensOwed0: pos.tokensOwed0,
          tokensOwed1: pos.tokensOwed1,
        });
      }

      // Step 5: Batch fetch pool data (slot0 + token info)
      const slot0Calls = Array.from(poolKeys.values()).map((pool) => ({
        address: POSITION_MANAGER as Address, // placeholder, will use computed pool address
      }));

      // For each pool, compute the actual pool address and get slot0
      const poolAddresses = await Promise.all(
        Array.from(poolKeys.values()).map(async (pool) => {
          try {
            return (await this.client.readContract({
              address: UNISWAP_V3_FACTORY as Address,
              abi: FACTORY_ABI,
              functionName: "getPool",
              args: [pool.token0 as Address, pool.token1 as Address, pool.fee],
            })) as string;
          } catch {
            return "0x0000000000000000000000000000000000000000";
          }
        }),
      );

      const poolDataCalls = poolAddresses.flatMap((poolAddr) => [
        {
          address: poolAddr as Address,
          abi: POOL_ABI,
          functionName: "slot0" as const,
        },
      ]);

      const slot0Results = poolDataCalls.length > 0
        ? await this.client.multicall({ contracts: poolDataCalls, allowFailure: true })
        : [];

      // Build pool data map
      const poolDataMap = new Map<string, { currentTick: number }>();
      const poolKeysArray = Array.from(poolKeys.keys());
      for (let i = 0; i < poolKeysArray.length; i++) {
        const res = slot0Results[i];
        if (res && res.status === "success") {
          const slot0 = res.result as unknown as readonly [bigint, number, ...unknown[]];
          poolDataMap.set(poolKeysArray[i]!, { currentTick: slot0[1] });
        }
      }

      // Step 6: Compute position values
      const result: ProtocolPosition[] = [];

      for (const pos of positions) {
        const poolKey = `${pos.token0.toLowerCase()}_${pos.token1.toLowerCase()}_${pos.fee}`;
        const poolData = poolDataMap.get(poolKey);
        if (!poolData) continue;

        const token0Info = getTokenInfo(pos.token0);
        const token1Info = getTokenInfo(pos.token1);
        const token0: Token = {
          address: pos.token0,
          chainId,
          symbol: token0Info.symbol,
          name: token0Info.name,
          decimals: token0Info.decimals,
        };
        const token1: Token = {
          address: pos.token1,
          chainId,
          symbol: token1Info.symbol,
          name: token1Info.name,
          decimals: token1Info.decimals,
        };

        const { amount0, amount1 } = getTokenAmounts(
          poolData.currentTick,
          pos.tickLower,
          pos.tickUpper,
          pos.liquidity,
          token0Info.decimals,
          token1Info.decimals,
        );

        const isOutOfRange = poolData.currentTick < pos.tickLower || poolData.currentTick > pos.tickUpper;
        const underlyingTokens: Array<{ token: Token; amount: bigint; valueInUsd: number | null }> = [];

        if (amount0 > 0n) {
          underlyingTokens.push({ token: token0, amount: amount0, valueInUsd: null });
        }
        if (amount1 > 0n) {
          underlyingTokens.push({ token: token1, amount: amount1, valueInUsd: null });
        }

        result.push({
          protocolId: this.protocolId,
          chainId,
          positionId: pos.tokenId.toString(),
          type: "lp",
          underlyingTokens,
          metadata: {
            tokenId: pos.tokenId.toString(),
            token0: pos.token0,
            token1: pos.token1,
            fee: pos.fee,
            tickLower: pos.tickLower,
            tickUpper: pos.tickUpper,
            currentTick: poolData.currentTick,
            outOfRange: isOutOfRange,
            unclaimedFees: {
              token0: pos.tokensOwed0.toString(),
              token1: pos.tokensOwed1.toString(),
            },
          },
        });
      }

      return result;
    } catch (err) {
      console.error("UniswapV3Adapter error:", err);
      return [];
    }
  }
}
