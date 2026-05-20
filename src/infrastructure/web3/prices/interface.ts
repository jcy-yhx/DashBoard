import type { Address } from "viem";

export interface IPriceAdapter {
  readonly source: string;
  getPrice(tokenAddress: Address, chainId: number): Promise<number | null>;
  getPrices(tokens: Array<{ address: Address; chainId: number }>): Promise<Map<string, number>>;
}
