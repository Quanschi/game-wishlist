import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getGameById, requestRemoval } from "@/lib/games";

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
    await requestRemoval(gameId, userId);
  } catch {
    return NextResponse.json(
      { error: "Spiel kann gerade nicht entfernt werden" },
      { status: 409 }
    );
  }

  const updated = await getGameById(gameId);
  return NextResponse.json({ game: updated });
}
