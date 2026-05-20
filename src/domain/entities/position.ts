import type { Token } from "./token";

export type PositionType = "lending" | "borrowing" | "lp" | "staking";

export interface UnderlyingToken {
  readonly token: Token;
  readonly amount: bigint;
  readonly valueInUsd: number | null;
}

export interface ProtocolPosition {
  readonly protocolId: string; // 'aave-v3', 'uniswap-v3', 'lido'
  readonly chainId: number;
  readonly positionId: string; // on-chain unique identifier
  readonly type: PositionType;
  readonly underlyingTokens: UnderlyingToken[];
  readonly metadata?: Record<string, unknown>; // protocol-specific fields
}
