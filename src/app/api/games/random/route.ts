import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getRandomActiveGame } from "@/lib/games";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const tag = req.nextUrl.searchParams.get("tag") ?? undefined;
  const game = await getRandomActiveGame(tag);
  if (!game) {
    return NextResponse.json(
      { error: "Keine aktiven Spiele auf der Liste" },
      { status: 404 }
    );
  }
  return NextResponse.json({ game });
}
