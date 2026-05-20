import { getSnapshots } from "@/infrastructure/db/repositories/snapshot-repo";
import type { HistoryQuery, HistoryResponse } from "./dto";

export async function getHistory(query: HistoryQuery): Promise<HistoryResponse> {
  const since = new Date();
  since.setDate(since.getDate() - query.days);

  const snapshots = await getSnapshots(query.wallet, since);

  return {
    wallet: query.wallet,
    snapshots: snapshots.map((s) => ({
      date: s.date,
      totalUsd: s.totalUsd,
    })),
  };
}
