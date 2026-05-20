import type { TokenBalance } from "./token";
import type { ProtocolPosition } from "./position";

export interface Portfolio {
  readonly wallet: string;
  readonly totalUsd: number;
  readonly tokenBalances: TokenBalance[];
  readonly positions: ProtocolPosition[];
  readonly snapshotTimestamp: Date;
  // Allocation breakdowns
  readonly allocationByToken: Array<{ symbol: string; valueUsd: number; percentage: number }>;
  readonly allocationByProtocol: Array<{
    protocolId: string;
    valueUsd: number;
    percentage: number;
  }>;
}

export interface PortfolioCache {
  readonly wallet: string;
  readonly portfolio: Portfolio;
  readonly cachedAt: Date;
}
