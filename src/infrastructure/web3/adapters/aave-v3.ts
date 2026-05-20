import { type Address, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import type { IProtocolAdapter } from "./interface";
import type { ProtocolPosition, Token } from "@/domain/entities";

const POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const POOL_DATA_PROVIDER = "0x41393e5e337606dc3821075Af65AeE84D7688E8B";

const POOL_DATA_PROVIDER_ABI = [
  {
    name: "getUserReservesData",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "provider", type: "address" },
      { name: "user", type: "address" },
    ],
    outputs: [{
      name: "", type: "tuple[]",
      components: [
        { name: "underlyingAsset", type: "address" },
        { name: "scaledATokenBalance", type: "uint256" },
        { name: "usageAsCollateralEnabledOnUser", type: "bool" },
        { name: "scaledVariableDebt", type: "uint256" },
        { name: "variableBorrowIndex", type: "uint256" },
        { name: "stableBorrowRate", type: "uint256" },
        { name: "scaledStableDebt", type: "uint256" },
        { name: "stableBorrowLastUpdateTimestamp", type: "uint256" },
        { name: "principalStableDebt", type: "uint256" },
      ],
    }],
  },
];

const POOL_ABI = [
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
];

const AAVE_RESERVES: Array<{ address: string; symbol: string; name: string; decimals: number }> = [
  { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", name: "USD Coin", decimals: 6 },
  { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", name: "Tether USD", decimals: 6 },
  { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", name: "Dai Stablecoin", decimals: 18 },
  { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", name: "Wrapped BTC", decimals: 8 },
  { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", symbol: "AAVE", name: "Aave Token", decimals: 18 },
  { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK", name: "Chainlink", decimals: 18 },
  { address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", symbol: "stETH", name: "Lido Staked ETH", decimals: 18 },
];

const reserveMap = new Map(AAVE_RESERVES.map((r) => [r.address.toLowerCase(), r]));

export interface AaveUserAccountData {
  totalCollateralUsd: number;
  totalDebtUsd: number;
  availableBorrowsUsd: number;
  liquidationThreshold: number;
  ltv: number;
  healthFactor: number;
}

export class AaveV3Adapter implements IProtocolAdapter {
  readonly protocolId = "aave-v3";
  readonly supportedChains = [mainnet.id];

  constructor(private readonly client: PublicClient) {}

  async getAccountData(address: string): Promise<AaveUserAccountData | null> {
    try {
      const data = await this.client.readContract({
        address: POOL as Address,
        abi: POOL_ABI,
        functionName: "getUserAccountData",
        args: [address as Address],
      }) as unknown as [bigint, bigint, bigint, bigint, bigint, bigint];

      return {
        totalCollateralUsd: Number(data[0]) / 1e8,
        totalDebtUsd: Number(data[1]) / 1e8,
        availableBorrowsUsd: Number(data[2]) / 1e8,
        liquidationThreshold: Number(data[3]) / 1e4,
        ltv: Number(data[4]) / 1e4,
        healthFactor: Number(data[5]) / 1e18,
      };
    } catch {
      return null;
    }
  }

  async getPositions(address: string, chainId: number): Promise<ProtocolPosition[]> {
    if (chainId !== mainnet.id) return [];

    try {
      // Fetch reserves data and account data in parallel
      const [reservesRaw, accountData] = await Promise.allSettled([
        this.client.readContract({
          address: POOL_DATA_PROVIDER as Address,
          abi: POOL_DATA_PROVIDER_ABI,
          functionName: "getUserReservesData",
          args: [POOL_DATA_PROVIDER as Address, address as Address],
        }),
        this.getAccountData(address),
      ]);

      const reserves = (reservesRaw.status === "fulfilled" ? reservesRaw.value : []) as Array<{
        underlyingAsset: string;
        scaledATokenBalance: bigint;
        usageAsCollateralEnabledOnUser: boolean;
        scaledVariableDebt: bigint;
        variableBorrowIndex: bigint;
      }>;

      const healthInfo = accountData.status === "fulfilled" ? accountData.value : null;

      const positions: ProtocolPosition[] = [];

      for (const reserve of reserves) {
        const reserveInfo = reserveMap.get(reserve.underlyingAsset.toLowerCase());
        if (!reserveInfo) continue;

        const token: Token = {
          address: reserveInfo.address,
          chainId,
          symbol: reserveInfo.symbol,
          name: reserveInfo.name,
          decimals: reserveInfo.decimals,
        };

        const supplied = reserve.scaledATokenBalance;
        if (supplied > 0n) {
          positions.push({
            protocolId: this.protocolId,
            chainId,
            positionId: `aave-v3-supply-${reserve.underlyingAsset.toLowerCase()}-${address}`,
            type: "lending",
            underlyingTokens: [{ token, amount: supplied, valueInUsd: null }],
            metadata: {
              usageAsCollateral: reserve.usageAsCollateralEnabledOnUser,
              healthFactor: healthInfo?.healthFactor ?? null,
              totalCollateralUsd: healthInfo?.totalCollateralUsd ?? null,
              totalDebtUsd: healthInfo?.totalDebtUsd ?? null,
              ltv: healthInfo?.ltv ?? null,
              liquidationThreshold: healthInfo?.liquidationThreshold ?? null,
            },
          });
        }

        const borrowed = reserve.scaledVariableDebt;
        if (borrowed > 0n) {
          positions.push({
            protocolId: this.protocolId,
            chainId,
            positionId: `aave-v3-borrow-${reserve.underlyingAsset.toLowerCase()}-${address}`,
            type: "borrowing",
            underlyingTokens: [{ token, amount: borrowed, valueInUsd: null }],
            metadata: {
              healthFactor: healthInfo?.healthFactor ?? null,
            },
          });
        }
      }

      return positions;
    } catch (err) {
      console.error("AaveV3Adapter error:", err);
      return [];
    }
  }
}
