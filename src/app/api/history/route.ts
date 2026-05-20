import { NextRequest, NextResponse } from "next/server";
import { historyQuerySchema } from "@/application/history/dto";
import { getHistory } from "@/application/history/get-history";
import { toUserFriendlyMessage } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = historyQuerySchema.safeParse({
      wallet: searchParams.get("wallet"),
      days: searchParams.get("days") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const history = await getHistory(parsed.data);
    return NextResponse.json(history);
  } catch (error) {
    console.error("History API error:", error);
    return NextResponse.json(
      { error: toUserFriendlyMessage(error) },
      { status: 500 },
    );
  }
}
