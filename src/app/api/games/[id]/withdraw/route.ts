import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getGameById, withdrawRequest } from "@/lib/games";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { id } = await params;
  const gameId = Number(id);

  try {
    await withdrawRequest(gameId, userId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Konnte nicht zurückgezogen werden";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const updated = await getGameById(gameId);
  return NextResponse.json({ game: updated });
}
