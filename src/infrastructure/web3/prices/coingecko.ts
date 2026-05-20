import type { Address } from "viem";
import type { IPriceAdapter } from "./interface";

const COINGECKO_IDS: Record<string, string> = {
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "weth",
  "0x0000000000000000000000000000000000000000": "ethereum",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "usd-coin",
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "tether",
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "wrapped-bitcoin",
  "0x6b175474e89094c44da98b954eedeac495271d0f": "dai",
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "uniswap",
  "0x514910771af9ca656af840dff83e8264ecf986ca": "chainlink",
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": "aave",
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": "staked-ether",
  "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0": "wrapped-steth",
};

export class CoinGeckoPriceAdapter implements IPriceAdapter {
  readonly source = "coingecko";
  private baseUrl = "https://api.coingecko.com/api/v3";

  constructor(private readonly apiKey?: string) {}

  async getPrice(tokenAddress: Address, _chainId: number): Promise<number | null> {
    const cgId = COINGECKO_IDS[tokenAddress.toLowerCase()];
    if (!cgId) return null;

    try {
      const url = `${this.baseUrl}/simple/price?ids=${cgId}&vs_currencies=usd`;
      const headers: Record<string, string> = {};
      if (this.apiKey) headers["x-cg-demo-api-key"] = this.apiKey;

      const res = await fetch(url, { headers });
      if (!res.ok) return null;

      const data = (await res.json()) as Record<string, { usd: number }>;
      return data[cgId]?.usd ?? null;
    } catch {
      return null;
    }
  }

  async getPrices(
    tokens: Array<{ address: Address; chainId: number }>,
  ): Promise<Map<string, number>> {
    const ids = tokens
      .map((t) => COINGECKO_IDS[t.address.toLowerCase()])
      .filter((id): id is string => !!id);

    if (ids.length === 0) return new Map();

    try {
      const url = `${this.baseUrl}/simple/price?ids=${ids.join(",")}&vs_currencies=usd`;
      const headers: Record<string, string> = {};
      if (this.apiKey) headers["x-cg-demo-api-key"] = this.apiKey;

      const res = await fetch(url, { headers });
      if (!res.ok) return new Map();

      const data = (await res.json()) as Record<string, { usd: number }>;
      const priceMap = new Map<string, number>();

      // Map CG ids back to token addresses
      const idToAddress = new Map(
        tokens
          .filter((t) => COINGECKO_IDS[t.address.toLowerCase()])
          .map((t) => [COINGECKO_IDS[t.address.toLowerCase()]!, t.address.toLowerCase()]),
      );

      for (const [id, priceData] of Object.entries(data)) {
        const addr = idToAddress.get(id);
        if (addr) {
          priceMap.set(`1:${addr}`, priceData.usd);
        }
      }

      return priceMap;
    } catch {
      return new Map();
    }
  }
}
