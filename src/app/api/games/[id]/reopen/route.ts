import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getGameById, reopenGame } from "@/lib/games";

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
    await reopenGame(gameId);
  } catch {
    return NextResponse.json(
      { error: "Spiel kann nicht zurück auf die Liste gesetzt werden" },
      { status: 409 }
    );
  }

  const updated = await getGameById(gameId);
  return NextResponse.json({ game: updated });
}
