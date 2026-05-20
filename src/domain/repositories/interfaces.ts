import type { Portfolio } from "../entities/portfolio";
import type { PortfolioSnapshot } from "../entities/snapshot";

export interface IPortfolioRepository {
  findLatestByWallet(wallet: string): Promise<Portfolio | null>;
  saveSnapshots(snapshots: PortfolioSnapshot[]): Promise<void>;
  getSnapshots(wallet: string, since: Date): Promise<PortfolioSnapshot[]>;
}
