import { NextRequest, NextResponse } from "next/server";
import { portfolioQuerySchema } from "@/application/portfolio/dto";
import { getPortfolio } from "@/application/portfolio/get-portfolio";
import { AdapterRegistry } from "@/infrastructure/web3/adapters/registry";
import { LidoAdapter } from "@/infrastructure/web3/adapters/lido";
import { AaveV3Adapter } from "@/infrastructure/web3/adapters/aave-v3";
import { getClient } from "@/infrastructure/web3/client";
import { toUserFriendlyMessage } from "@/lib/errors";

// Singleton registry — adapter instances are cached across requests
let registryInstance: AdapterRegistry | null = null;

function getRegistry(): AdapterRegistry {
  if (registryInstance) return registryInstance;

  const client = getClient(1); // Ethereum mainnet
  const registry = new AdapterRegistry();

  // Register protocol adapters (add new protocols here)
  registry.register(new LidoAdapter(client));
  registry.register(new AaveV3Adapter(client));

  registryInstance = registry;
  return registry;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = portfolioQuerySchema.safeParse({
      wallet: searchParams.get("wallet"),
      chainId: searchParams.get("chainId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const registry = getRegistry();
    const portfolio = await getPortfolio(parsed.data, registry);

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error("Portfolio API error:", error);
    return NextResponse.json(
      { error: toUserFriendlyMessage(error) },
      { status: 500 },
    );
  }
}
