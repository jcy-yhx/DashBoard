import { type Address, type PublicClient, erc20Abi, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import type { IProtocolAdapter } from "./interface";
import type { ProtocolPosition, Token } from "@/domain/entities";

// stETH: 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84
// wstETH: 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0
const STETH_ADDRESS = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
const WSTETH_ADDRESS = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0";

const WSTETH_ABI = parseAbi([
  "function getStETHByWstETH(uint256 wstETHAmount) external view returns (uint256)",
]);

const STETH_TOKEN: Token = {
  address: STETH_ADDRESS,
  chainId: mainnet.id,
  symbol: "stETH",
  name: "Lido Staked Ether",
  decimals: 18,
};

const WSTETH_TOKEN: Token = {
  address: WSTETH_ADDRESS,
  chainId: mainnet.id,
  symbol: "wstETH",
  name: "Wrapped stETH",
  decimals: 18,
};

export class LidoAdapter implements IProtocolAdapter {
  readonly protocolId = "lido";
  readonly supportedChains = [mainnet.id];

  constructor(private readonly client: PublicClient) {}

  async getPositions(address: string, chainId: number): Promise<ProtocolPosition[]> {
    if (chainId !== mainnet.id) return [];

    try {
      const [stEthBalance, wstEthBalance] = await this.client.multicall({
        contracts: [
          {
            address: STETH_ADDRESS as Address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as Address],
          },
          {
            address: WSTETH_ADDRESS as Address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as Address],
          },
        ],
        allowFailure: true,
      });

      const positions: ProtocolPosition[] = [];

      // stETH position
      const stEthAmount = stEthBalance.status === "success" ? (stEthBalance.result as bigint) : 0n;
      if (stEthAmount > 0n) {
        positions.push({
          protocolId: this.protocolId,
          chainId,
          positionId: `steth-${address}`,
          type: "staking",
          underlyingTokens: [
            { token: STETH_TOKEN, amount: stEthAmount, valueInUsd: null },
          ],
          metadata: { apy: 0.03 }, // ~3% APR placeholder
        });
      }

      // wstETH position — unwrap to stETH equivalent
      const wstEthAmount = wstEthBalance.status === "success" ? (wstEthBalance.result as bigint) : 0n;
      if (wstEthAmount > 0n) {
        let stEthEquivalent = 0n;
        try {
          stEthEquivalent = (await this.client.readContract({
            address: WSTETH_ADDRESS as Address,
            abi: WSTETH_ABI,
            functionName: "getStETHByWstETH",
            args: [wstEthAmount],
          })) as bigint;
        } catch {
          // Fallback: approximate 1:1 (actual ratio is ~1.1x and growing)
          stEthEquivalent = wstEthAmount;
        }

        positions.push({
          protocolId: this.protocolId,
          chainId,
          positionId: `wsteth-${address}`,
          type: "staking",
          underlyingTokens: [
            { token: STETH_TOKEN, amount: stEthEquivalent, valueInUsd: null },
          ],
          metadata: { apy: 0.03, wrappedToken: "wstETH", rawAmount: wstEthAmount.toString() },
        });
      }

      return positions;
    } catch {
      return [];
    }
  }
}
