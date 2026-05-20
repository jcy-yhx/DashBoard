import { saveSnapshot } from "@/infrastructure/db/repositories/snapshot-repo";
import type { Portfolio, PortfolioSnapshot, SnapshotEntry } from "@/domain/entities";

export async function takeSnapshot(portfolio: Portfolio): Promise<PortfolioSnapshot> {
  const today = new Date().toISOString().slice(0, 10);

  const breakdown: SnapshotEntry[] = [
    ...portfolio.tokenBalances.map((tb) => ({
      tokenId: tb.token.address,
      symbol: tb.token.symbol,
      amount: tb.balance.toString(),
      valueUsd: tb.valueInUsd ?? 0,
      source: "wallet" as const,
    })),
    ...portfolio.positions.flatMap((pos) =>
      pos.underlyingTokens.map((ut) => ({
        tokenId: ut.token.address,
        symbol: ut.token.symbol,
        amount: ut.amount.toString(),
        valueUsd: ut.valueInUsd ?? 0,
        source: "protocol" as const,
        protocolId: pos.protocolId,
      })),
    ),
  ];

  const snapshot: PortfolioSnapshot = {
    wallet: portfolio.wallet,
    date: today,
    totalUsd: portfolio.totalUsd,
    breakdown,
  };

  await saveSnapshot(snapshot);
  return snapshot;
}
