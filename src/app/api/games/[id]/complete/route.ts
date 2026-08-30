import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getGameById, requestCompletion } from "@/lib/games";

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
    await requestCompletion(gameId, userId);
  } catch {
    return NextResponse.json(
      { error: "Spiel kann nicht als abgeschlossen markiert werden" },
      { status: 409 }
    );
  }

  const updated = await getGameById(gameId);
  return NextResponse.json({ game: updated });
}
