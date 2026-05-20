import type { YieldOpportunity } from "@/infrastructure/web3/adapters/interface";
import type { AdapterRegistry } from "@/infrastructure/web3/adapters/registry";
import { withTimeout } from "@/lib/timeout";

export async function getYieldOpportunities(
  registry: AdapterRegistry,
  chainId: number,
): Promise<YieldOpportunity[]> {
  const adapters = Array.from(registry.listAdapters()).filter((a) =>
    a.supportedChains.includes(chainId) && a.getYieldOpportunities,
  );

  if (adapters.length === 0) return [];

  const results = await Promise.allSettled(
    adapters.map((adapter) =>
      withTimeout(adapter.getYieldOpportunities!(chainId), 5000, [])
        .catch(() => [] as YieldOpportunity[]),
    ),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<YieldOpportunity[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => b.apy - a.apy);
}
