import { type Address } from "viem";
import { getClient } from "@/infrastructure/web3/client";
import { Erc20Adapter } from "@/infrastructure/web3/adapters/erc20";
import { AdapterRegistry } from "@/infrastructure/web3/adapters/registry";
import { ChainlinkPriceAdapter } from "@/infrastructure/web3/prices/chainlink";
import { UniswapPoolPriceAdapter } from "@/infrastructure/web3/prices/uniswap-pool";
import { CoinGeckoPriceAdapter } from "@/infrastructure/web3/prices/coingecko";
import { PriceAggregator } from "@/domain/services/price-aggregator";
import { calculatePortfolio } from "@/domain/services/portfolio-calculator";
import { bigintToUsd, fromTokenDecimals } from "@/lib/bigint";
import { getEnv } from "@/infrastructure/config/env";
import type { Token, TokenBalance } from "@/domain/entities";
import type { ProtocolPosition } from "@/domain/entities";
import type { PortfolioQuery, PortfolioResponse } from "./dto";

export async function getPortfolio(
  query: PortfolioQuery,
  registry: AdapterRegistry,
): Promise<PortfolioResponse> {
  const { wallet, chainId } = query;
  const client = getClient(chainId as 1 | 42161);

  // 1. Fetch native + ERC20 balances
  const erc20Adapter = new Erc20Adapter(client);
  const { native, tokens } = await erc20Adapter.getBalances(wallet);

  const nativeToken: Token = {
    address: "0x0000000000000000000000000000000000000000",
    chainId,
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
  };

  const tokenBalances: TokenBalance[] = [
    {
      token: nativeToken,
      balance: native,
      valueInUsd: null,
    },
    ...tokens.map((t) => ({
      token: {
        address: t.token.address,
        chainId,
        symbol: t.token.symbol,
        name: t.token.name,
        decimals: t.token.decimals,
      } satisfies Token,
      balance: t.balance,
      valueInUsd: null,
    })),
  ];

  // 2. Fetch DeFi positions (graceful degradation)
  let positions: ProtocolPosition[] = [];
  try {
    positions = await registry.aggregatePositions(wallet, chainId);
  } catch (err) {
    console.error("Failed to fetch positions:", err);
  }

  // 3. Price lookup: Chainlink → Uniswap Pool → CoinGecko
  const priceAggregator = new PriceAggregator([
    new ChainlinkPriceAdapter(client),
    new UniswapPoolPriceAdapter(client),
    new CoinGeckoPriceAdapter(getEnv().COINGECKO_API_KEY),
  ]);

  // Collect all token addresses that need pricing
  const tokensToPrice = new Map<string, { address: Address; chainId: number }>();
  for (const tb of tokenBalances) {
    const key = `${tb.token.chainId}:${tb.token.address.toLowerCase()}`;
    if (!tokensToPrice.has(key)) {
      tokensToPrice.set(key, {
        address: tb.token.address as Address,
        chainId: tb.token.chainId,
      });
    }
  }
  for (const pos of positions) {
    for (const ut of pos.underlyingTokens) {
      const key = `${ut.token.chainId}:${ut.token.address.toLowerCase()}`;
      if (!tokensToPrice.has(key)) {
        tokensToPrice.set(key, {
          address: ut.token.address as Address,
          chainId: ut.token.chainId,
        });
      }
    }
  }

  const prices = await priceAggregator.getPrices(
    Array.from(tokensToPrice.values()),
  );

  // 4. Apply prices to token balances
  for (const tb of tokenBalances) {
    const key = `${tb.token.chainId}:${tb.token.address.toLowerCase()}`;
    const price = prices.get(key);
    if (price !== undefined) {
      tb.valueInUsd = bigintToUsd(tb.balance, tb.token.decimals, price);
    }
  }

  // 5. Apply prices to position underlying tokens
  for (const pos of positions) {
    for (const ut of pos.underlyingTokens) {
      const key = `${ut.token.chainId}:${ut.token.address.toLowerCase()}`;
      const price = prices.get(key);
      if (price !== undefined) {
        ut.valueInUsd = bigintToUsd(ut.amount, ut.token.decimals, price);
      }
    }
  }

  // 6. Calculate final portfolio with USD values
  const portfolio = calculatePortfolio(wallet, tokenBalances, positions);

  // 7. Map to response DTO
  return {
    wallet: portfolio.wallet,
    totalUsd: portfolio.totalUsd,
    snapshotTimestamp: portfolio.snapshotTimestamp.toISOString(),
    tokenBalances: portfolio.tokenBalances.map((tb) => ({
      token: {
        address: tb.token.address,
        chainId: tb.token.chainId,
        symbol: tb.token.symbol,
        name: tb.token.name,
        decimals: tb.token.decimals,
      },
      balance: fromTokenDecimals(tb.balance, tb.token.decimals),
      valueInUsd: tb.valueInUsd,
    })),
    positions: portfolio.positions.map((pos) => ({
      protocolId: pos.protocolId,
      chainId: pos.chainId,
      positionId: pos.positionId,
      type: pos.type,
      underlyingTokens: pos.underlyingTokens.map((ut) => ({
        token: {
          address: ut.token.address,
          chainId: ut.token.chainId,
          symbol: ut.token.symbol,
          name: ut.token.name,
          decimals: ut.token.decimals,
        },
        amount: fromTokenDecimals(ut.amount, ut.token.decimals),
        valueInUsd: ut.valueInUsd,
      })),
    })),
    allocationByToken: portfolio.allocationByToken,
    allocationByProtocol: portfolio.allocationByProtocol,
  };
}
