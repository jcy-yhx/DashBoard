import { erc20Abi, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import type { IProtocolAdapter } from "./interface";
import type { ProtocolPosition } from "@/domain/entities";

const KNOWN_TOKENS: Array<{
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}> = [
  { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", name: "USD Coin", decimals: 6 },
  { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", name: "Tether USD", decimals: 6 },
  { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", name: "Wrapped BTC", decimals: 8 },
  { address: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", symbol: "wstETH", name: "Wrapped stETH", decimals: 18 },
  { address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", symbol: "stETH", name: "Lido Staked ETH", decimals: 18 },
  { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", name: "Dai Stablecoin", decimals: 18 },
  { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI", name: "Uniswap", decimals: 18 },
  { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK", name: "Chainlink", decimals: 18 },
  { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", symbol: "AAVE", name: "Aave Token", decimals: 18 },
];

export class Erc20Adapter {
  constructor(private readonly client: PublicClient) {}

  async getBalances(address: string): Promise<{
    native: bigint;
    tokens: Array<{ token: (typeof KNOWN_TOKENS)[number]; balance: bigint }>;
  }> {
    const [native, tokenResults] = await Promise.all([
      this.client.getBalance({ address: address as `0x${string}` }),
      this.client.multicall({
        contracts: KNOWN_TOKENS.map((token) => ({
          address: token.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        })),
        allowFailure: true,
      }),
    ]);

    const tokens = KNOWN_TOKENS.filter((_, i) => {
      const res = tokenResults[i];
      if (res?.status !== "success") return false;
      const val = res.result as bigint;
      return val > 0n;
    }).map((token) => {
      const actualIndex = KNOWN_TOKENS.indexOf(token);
      const res = tokenResults[actualIndex]!;
      return {
        token,
        balance: res.result as bigint,
      };
    });

    return { native, tokens };
  }
}
