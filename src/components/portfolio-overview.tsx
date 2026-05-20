"use client";

interface PortfolioOverviewProps {
  data: {
    totalUsd: number;
    tokenBalances: Array<{ token: { symbol: string }; valueInUsd: number }>;
    allocationByToken: Array<{ symbol: string; valueUsd: number; percentage: number }>;
    allocationByProtocol: Array<{ protocolId: string; valueUsd: number; percentage: number }>;
  };
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function PortfolioOverview({ data }: PortfolioOverviewProps) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-6">
      <div className="mb-6">
        <p className="text-sm text-gray-400">Total Portfolio Value</p>
        <p className="text-4xl font-bold mt-1 tracking-tight">
          {formatUsd(data.totalUsd)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Allocation
          </h3>
          <div className="space-y-2">
            {data.allocationByToken.slice(0, 5).map((item) => (
              <div key={item.symbol} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: `hsl(${data.allocationByToken.indexOf(item) * 60}, 70%, 55%)`,
                    }}
                  />
                  <span className="text-sm">{item.symbol}</span>
                </div>
                <div className="text-sm text-gray-400">
                  <span className="text-white mr-2">{formatUsd(item.valueUsd)}</span>
                  {item.percentage.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {data.allocationByProtocol.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Protocols
            </h3>
            <div className="space-y-2">
              {data.allocationByProtocol.map((item) => (
                <div key={item.protocolId} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{item.protocolId.replace("-", " ")}</span>
                  <span className="text-sm text-gray-400">
                    <span className="text-white mr-2">{formatUsd(item.valueUsd)}</span>
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
