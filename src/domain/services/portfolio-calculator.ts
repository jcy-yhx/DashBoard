import type { TokenBalance } from "../entities/token";
import type { ProtocolPosition } from "../entities/position";
import type { Portfolio, PortfolioCache } from "../entities/portfolio";

export function calculatePortfolio(
  wallet: string,
  tokenBalances: TokenBalance[],
  positions: ProtocolPosition[],
): Portfolio {
  const tokenUsd = tokenBalances.reduce(
    (sum, tb) => sum + (tb.valueInUsd ?? 0),
    0,
  );

  const positionUsd = positions.reduce(
    (sum, pos) =>
      sum +
      pos.underlyingTokens.reduce((s, ut) => s + (ut.valueInUsd ?? 0), 0),
    0,
  );

  const totalUsd = tokenUsd + positionUsd;

  // Token allocation
  const tokenMap = new Map<string, number>();
  for (const tb of tokenBalances) {
    if (tb.valueInUsd) {
      tokenMap.set(
        tb.token.symbol,
        (tokenMap.get(tb.token.symbol) ?? 0) + tb.valueInUsd,
      );
    }
  }
  const allocationByToken = Array.from(tokenMap.entries())
    .map(([symbol, valueUsd]) => ({
      symbol,
      valueUsd,
      percentage: totalUsd > 0 ? (valueUsd / totalUsd) * 100 : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  // Protocol allocation
  const protocolMap = new Map<string, number>();
  for (const pos of positions) {
    const posUsd = pos.underlyingTokens.reduce(
      (s, ut) => s + (ut.valueInUsd ?? 0),
      0,
    );
    protocolMap.set(
      pos.protocolId,
      (protocolMap.get(pos.protocolId) ?? 0) + posUsd,
    );
  }
  const allocationByProtocol = Array.from(protocolMap.entries())
    .map(([protocolId, valueUsd]) => ({
      protocolId,
      valueUsd,
      percentage: totalUsd > 0 ? (valueUsd / totalUsd) * 100 : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  return {
    wallet,
    totalUsd,
    tokenBalances,
    positions,
    snapshotTimestamp: new Date(),
    allocationByToken,
    allocationByProtocol,
  };
}
