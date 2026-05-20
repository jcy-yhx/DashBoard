"use client";

import { useState, useCallback } from "react";

interface WalletState {
  address: string | null;
  isConnected: boolean;
}

// MVP 阶段不使用 wagmi 的完整 React 绑定，
// 等 wagmi v3 稳定后替换为 useAccount()。
// 这里先用轻量实现，支持 mock 地址便于开发调试。
export function useWallet(): WalletState & {
  connect: () => void;
  disconnect: () => void;
} {
  const [state, setState] = useState<WalletState>({
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth for demo
    isConnected: true,
  });

  const connect = useCallback(() => {
    // TODO: 集成 wagmi useConnect
  }, []);

  const disconnect = useCallback(() => {
    setState({ address: null, isConnected: false });
  }, []);

  return { ...state, connect, disconnect };
}
