"use client";

interface Position {
  protocolId: string;
  type: "lending" | "borrowing" | "lp" | "staking";
  positionId: string;
  underlyingTokens: Array<{ token: { symbol: string }; amount: string; valueInUsd: number | null }>;
  metadata?: Record<string, unknown>;
}

interface PositionsListProps {
  positions: Position[];
}

function formatUsd(value: number | null): string {
  if (value === null || value === 0) return "$0.00";
  if (value < 0.01) return "< $0.01";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function positionTypeLabel(type: string): { text: string; color: string } {
  switch (type) {
    case "lending": return { text: "Supply", color: "text-green-400" };
    case "borrowing": return { text: "Borrow", color: "text-red-400" };
    case "staking": return { text: "Stake", color: "text-blue-400" };
    case "lp": return { text: "LP", color: "text-purple-400" };
    default: return { text: type, color: "text-gray-400" };
  }
}

export function PositionsList({ positions }: PositionsListProps) {
  if (positions.length === 0) return null;

  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden">
      <div className="px-6 py-3 border-b border-card-border">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          DeFi Positions
        </h2>
      </div>
      <div className="divide-y divide-card-border">
        {positions.map((pos) => {
          const label = positionTypeLabel(pos.type);
          const totalUsd = pos.underlyingTokens.reduce(
            (sum, ut) => sum + (ut.valueInUsd ?? 0),
            0,
          );

          return (
            <div key={pos.positionId} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">
                      {pos.protocolId.replace("-", " ")}
                    </span>
                    <span className={`text-xs font-medium ${label.color}`}>
                      {label.text}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    {pos.underlyingTokens.map((ut, i) => (
                      <span key={i} className="text-xs text-gray-500">
                        {Number(ut.amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
                        {ut.token.symbol}
                      </span>
                    ))}
                  </div>
                  {Boolean(pos.metadata?.outOfRange) && (
                    <span className="text-xs text-yellow-400 mt-0.5 block">
                      Out of range
                    </span>
                  )}
                </div>
              </div>
              <span className="text-sm font-medium">{formatUsd(totalUsd)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
