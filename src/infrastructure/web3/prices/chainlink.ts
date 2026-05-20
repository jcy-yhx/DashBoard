import { type Address, type PublicClient, parseAbi } from "viem";
import type { IPriceAdapter } from "./interface";

const CHAINLINK_FEEDS: Record<number, Record<string, string>> = {
  1: {
    // Ethereum Mainnet
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // WETH → ETH/USD
    "0x0000000000000000000000000000000000000000": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // ETH → ETH/USD
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c", // WBTC → BTC/USD
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", // USDC → USDC/USD
    "0xdAC17F958D2ee523a2206206994597C13D831ec7": "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", // USDT → USDT/USD
    "0x6B175474E89094C44Da98b954EedeAC495271d0F": "0xAed0c38402a5d19df6E4c03F4E2DceD6eAf1bB29", // DAI → DAI/USD
    "0x514910771AF9Ca656af840dff83E8264EcF986CA": "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c", // LINK → LINK/USD
    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984": "0x553303d460EE0afB44Ed5d8e0B360a7dA6D8aE85", // UNI → UNI/USD
    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9": "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9", // AAVE → AAVE/USD
    "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84": "0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8", // stETH → stETH/USD
    "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0": "0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8", // wstETH → stETH/USD (same underlying)
  },
};

const AGGREGATOR_ABI = parseAbi([
  "function latestAnswer() external view returns (int256)",
  "function decimals() external view returns (uint8)",
]);

export class ChainlinkPriceAdapter implements IPriceAdapter {
  readonly source = "chainlink";

  constructor(private readonly client: PublicClient) {}

  async getPrice(tokenAddress: Address, chainId: number): Promise<number | null> {
    const feeds = CHAINLINK_FEEDS[chainId];
    if (!feeds) return null;

    const feedAddress = feeds[tokenAddress.toLowerCase()];
    if (!feedAddress) return null;

    try {
      const [answer, decimals] = await this.client.multicall({
        contracts: [
          {
            address: feedAddress as Address,
            abi: AGGREGATOR_ABI,
            functionName: "latestAnswer",
          },
          {
            address: feedAddress as Address,
            abi: AGGREGATOR_ABI,
            functionName: "decimals",
          },
        ],
        allowFailure: false,
      });

      if (answer === undefined || decimals === undefined) return null;
      return Number(answer as bigint) / 10 ** (decimals as number);
    } catch {
      return null;
    }
  }

  async getPrices(
    tokens: Array<{ address: Address; chainId: number }>,
  ): Promise<Map<string, number>> {
    const results = await Promise.allSettled(
      tokens.map((t) => this.getPrice(t.address, t.chainId)),
    );

    const priceMap = new Map<string, number>();
    results.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value !== null) {
        const key = `${tokens[i]!.chainId}:${tokens[i]!.address.toLowerCase()}`;
        priceMap.set(key, result.value);
      }
    });

    return priceMap;
  }
}
