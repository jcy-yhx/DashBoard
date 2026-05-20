import type { PublicClient, ContractFunctionParameters } from "viem";

interface QueuedCall {
  call: ContractFunctionParameters;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

export class MulticallBatcher {
  private queue: QueuedCall[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  constructor(
    private readonly client: PublicClient,
    private readonly delayMs: number = 50,
  ) {}

  async execute<T>(call: ContractFunctionParameters): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        call,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.scheduleFlush();
    });
  }

  private scheduleFlush(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delayMs);
  }

  private async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;

    const batch = [...this.queue];
    this.queue = [];

    if (batch.length === 0) {
      this.flushing = false;
      return;
    }

    try {
      const results = await this.client.multicall({
        contracts: batch.map((q) => q.call),
        allowFailure: true,
      });

      results.forEach((res, index) => {
        const queued = batch[index]!;
        if (res.status === "success") {
          queued.resolve(res.result);
        } else {
          queued.reject(res.error);
        }
      });
    } catch (error) {
      batch.forEach((q) => q.reject(error));
    } finally {
      this.flushing = false;
    }
  }
}
