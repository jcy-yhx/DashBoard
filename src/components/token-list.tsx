"use client";

interface TokenBalance {
  token: { symbol: string; address: string; decimals: number };
  balance: string; // bigint as string for JSON serialization
  valueInUsd: number | null;
}

interface TokenListProps {
  balances: TokenBalance[];
}

function formatBalance(balance: string, decimals: number): string {
  const num = parseFloat(balance);
  if (num < 0.001) return "< 0.001";
  return num.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function formatUsd(value: number | null): string {
  if (value === null) return "--";
  if (value === 0) return "$0.00";
  if (value < 0.01) return "< $0.01";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function TokenList({ balances }: TokenListProps) {
  const sorted = [...balances].sort((a, b) => (b.valueInUsd ?? 0) - (a.valueInUsd ?? 0));

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-6 text-center text-gray-400">
        No token balances found
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden">
      <div className="px-6 py-3 border-b border-card-border">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Token Balances
        </h2>
      </div>
      <div className="divide-y divide-card-border">
        {sorted.map((tb) => (
          <div key={tb.token.address} className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold">
                {tb.token.symbol.slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-medium">{tb.token.symbol}</p>
                <p className="text-xs text-gray-500">
                  {formatBalance(tb.balance, tb.token.decimals)}
                </p>
              </div>
            </div>
            <span className="text-sm font-medium">{formatUsd(tb.valueInUsd)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
