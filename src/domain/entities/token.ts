export interface Token {
  readonly address: string;
  readonly chainId: number;
  readonly symbol: string;
  readonly name: string;
  readonly decimals: number;
  readonly logoUrl?: string;
}

export interface TokenBalance {
  readonly token: Token;
  readonly balance: bigint;
  readonly valueInUsd: number | null;
}
