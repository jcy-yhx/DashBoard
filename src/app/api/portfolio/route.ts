import { NextRequest, NextResponse } from "next/server";
import { portfolioQuerySchema } from "@/application/portfolio/dto";
import { getPortfolio } from "@/application/portfolio/get-portfolio";
import { AdapterRegistry } from "@/infrastructure/web3/adapters/registry";
import { toUserFriendlyMessage } from "@/lib/errors";

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

    // In production, wire up adapters via DI container
    const registry = new AdapterRegistry();
    // registry.register(new LidoAdapter(...));
    // registry.register(new AaveV3Adapter(...));

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
