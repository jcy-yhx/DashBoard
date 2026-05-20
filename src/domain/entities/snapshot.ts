export interface SnapshotEntry {
  readonly tokenId: string;
  readonly symbol: string;
  readonly amount: string; // normalized decimal string
  readonly valueUsd: number;
  readonly source: "wallet" | "protocol";
  readonly protocolId?: string;
}

export interface PortfolioSnapshot {
  readonly wallet: string;
  readonly date: string; // YYYY-MM-DD
  readonly totalUsd: number;
  readonly breakdown: SnapshotEntry[];
}

export interface HistoricalSnapshot {
  readonly wallet: string;
  readonly snapshots: PortfolioSnapshot[];
  readonly oldestDate: string;
  readonly newestDate: string;
}
