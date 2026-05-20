import { db } from "@/infrastructure/db";
import { portfolioSnapshots } from "@/infrastructure/db/schema";
import type { PortfolioSnapshot } from "@/domain/entities";
import { eq, gte, desc } from "drizzle-orm";

export async function saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
  await db
    .insert(portfolioSnapshots)
    .values({
      wallet: snapshot.wallet,
      date: snapshot.date,
      totalUsd: snapshot.totalUsd,
      breakdown: snapshot.breakdown,
    })
    .onConflictDoUpdate({
      target: [portfolioSnapshots.wallet, portfolioSnapshots.date],
      set: {
        totalUsd: snapshot.totalUsd,
        breakdown: snapshot.breakdown,
        createdAt: new Date(),
      },
    });
}

export async function getSnapshots(
  wallet: string,
  since: Date,
): Promise<PortfolioSnapshot[]> {
  const rows = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      eq(portfolioSnapshots.wallet, wallet),
    )
    .orderBy(desc(portfolioSnapshots.date));

  // Filter in-memory (Drizzle where chain limitation)
  const filtered = rows.filter((r) => new Date(r.date) >= since);

  return filtered.map((r) => ({
    wallet: r.wallet,
    date: new Date(r.date).toISOString().slice(0, 10),
    totalUsd: r.totalUsd,
    breakdown: r.breakdown as PortfolioSnapshot["breakdown"],
  }));
}
