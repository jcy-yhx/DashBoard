import type { ProtocolPosition } from "@/domain/entities";

export interface YieldOpportunity {
  readonly protocolId: string;
  readonly chainId: number;
  readonly asset: string;
  readonly apy: number;
  readonly tvl: number;
  readonly risk: "low" | "medium" | "high";
}

export interface IProtocolAdapter {
  readonly protocolId: string;
  readonly supportedChains: number[];
  getPositions(address: string, chainId: number): Promise<ProtocolPosition[]>;
  getYieldOpportunities?(chainId: number): Promise<YieldOpportunity[]>;
}
