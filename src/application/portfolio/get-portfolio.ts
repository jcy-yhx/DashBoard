import { getClient } from "@/infrastructure/web3/client";
import { Erc20Adapter } from "@/infrastructure/web3/adapters/erc20";
import { AdapterRegistry } from "@/infrastructure/web3/adapters/registry";
import { calculatePortfolio } from "@/domain/services/portfolio-calculator";
import { bigintToUsd, fromTokenDecimals } from "@/lib/bigint";
import type { Token, TokenBalance } from "@/domain/entities";
import type { Portfolio, ProtocolPosition } from "@/domain/entities";
import type { PortfolioQuery, PortfolioResponse } from "./dto";
import { ApplicationError } from "@/lib/errors";

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

  // 2. Convert balances to domain entities
  const tokenBalances: TokenBalance[] = [
    {
      token: nativeToken,
      balance: native,
      valueInUsd: null, // Will be priced in next iteration
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

  // 3. Fetch DeFi positions
  let positions: ProtocolPosition[] = [];
  try {
    positions = await registry.aggregatePositions(wallet, chainId);
  } catch (err) {
    // Graceful degradation: show wallet balances even if positions fail
    console.error("Failed to fetch positions:", err);
  }

  // 4. Calculate portfolio (without USD pricing for now—Week 2)
  const portfolio = calculatePortfolio(wallet, tokenBalances, positions);

  // 5. Map to response DTO (bigint → string)
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
