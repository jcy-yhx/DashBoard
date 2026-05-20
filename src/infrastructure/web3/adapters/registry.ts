import type { IProtocolAdapter } from "./interface";
import type { ProtocolPosition } from "@/domain/entities";
import { withTimeout } from "@/lib/timeout";

export class AdapterRegistry {
  private adapters = new Map<string, IProtocolAdapter>();

  register(adapter: IProtocolAdapter): void {
    if (this.adapters.has(adapter.protocolId)) {
      throw new Error(`Adapter for protocol '${adapter.protocolId}' already registered`);
    }
    this.adapters.set(adapter.protocolId, adapter);
  }

  get(protocolId: string): IProtocolAdapter | undefined {
    return this.adapters.get(protocolId);
  }

  listAdapters(): IProtocolAdapter[] {
    return Array.from(this.adapters.values());
  }

  async aggregatePositions(address: string, chainId: number): Promise<ProtocolPosition[]> {
    const adapters = Array.from(this.adapters.values()).filter((a) =>
      a.supportedChains.includes(chainId),
    );

    const results = await Promise.allSettled(
      adapters.map((adapter) =>
        withTimeout(adapter.getPositions(address, chainId), 5000, []).catch(
          () => [] as ProtocolPosition[],
        ),
      ),
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<ProtocolPosition[]> =>
          r.status === "fulfilled",
      )
      .flatMap((r) => r.value);
  }
}
