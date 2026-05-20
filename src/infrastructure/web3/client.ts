import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { mainnet, arbitrum } from "viem/chains";

type ChainId = typeof mainnet.id | typeof arbitrum.id;

const RPC_URLS: Record<ChainId, { primary: string; fallback: string }> = {
  [mainnet.id]: {
    primary: process.env.RPC_URL_ETHEREUM!,
    fallback: process.env.RPC_URL_ETHEREUM_FALLBACK!,
  },
  [arbitrum.id]: {
    primary: process.env.RPC_URL_ARBITRUM!,
    fallback: process.env.RPC_URL_ARBITRUM_FALLBACK!,
  },
} as const;

const chainConfigs = {
  [mainnet.id]: mainnet,
  [arbitrum.id]: arbitrum,
} as const;

const clients = new Map<ChainId, PublicClient>();

function createClient(chainId: ChainId): PublicClient {
  const urls = RPC_URLS[chainId];
  const chain = chainConfigs[chainId];

  return createPublicClient({
    chain,
    transport: fallback([http(urls.primary), http(urls.fallback)]),
    batch: {
      multicall: {
        batchSize: 4096,
        wait: 50,
      },
    },
  });
}

export function getClient(chainId: ChainId): PublicClient {
  let client = clients.get(chainId);
  if (!client) {
    client = createClient(chainId);
    clients.set(chainId, client);
  }
  return client;
}

export function getDefaultClient(): PublicClient {
  return getClient(mainnet.id);
}

export { mainnet, arbitrum };
export type { ChainId };
