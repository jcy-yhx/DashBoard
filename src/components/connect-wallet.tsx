"use client";

import { useWallet } from "@/hooks/use-wallet";

export function ConnectWallet() {
  const { address, isConnected, disconnect } = useWallet();

  if (!isConnected || !address) {
    return (
      <button className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors">
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-400 hidden sm:inline">
        {address.slice(0, 6)}...{address.slice(-4)}
      </span>
      <button
        onClick={disconnect}
        className="px-3 py-1.5 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-gray-500 transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
