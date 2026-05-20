"use client";

import { useQuery } from "@tanstack/react-query";
import { ConnectWallet } from "@/components/connect-wallet";
import { PortfolioOverview } from "@/components/portfolio-overview";
import { NetWorthChart } from "@/components/net-worth-chart";
import { TokenList } from "@/components/token-list";
import { PositionsList } from "@/components/positions-list";
import { useWallet } from "@/hooks/use-wallet";

export default function Home() {
  const { address, isConnected } = useWallet();

  const { data, isLoading, error } = useQuery({
    queryKey: ["portfolio", address],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio?wallet=${address}`);
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      return res.json();
    },
    enabled: !!address,
  });

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DeFi Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Portfolio aggregator</p>
        </div>
        <ConnectWallet />
      </header>

      {!isConnected && (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400">
          <p className="text-lg">Connect your wallet to get started</p>
          <p className="text-sm mt-2">Supports Ethereum mainnet & Arbitrum</p>
        </div>
      )}

      {isConnected && isLoading && (
        <div className="space-y-4">
          <div className="h-32 bg-card animate-pulse rounded-xl" />
          <div className="h-64 bg-card animate-pulse rounded-xl" />
        </div>
      )}

      {isConnected && error && (
        <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/5">
          <p className="text-red-400">Failed to load portfolio data. Please try again.</p>
        </div>
      )}

      {isConnected && data && (
        <div className="space-y-6">
          <PortfolioOverview data={data} />
          <NetWorthChart wallet={address!} />
          <TokenList balances={data.tokenBalances} />
          <PositionsList positions={data.positions} />
        </div>
      )}
    </main>
  );
}
