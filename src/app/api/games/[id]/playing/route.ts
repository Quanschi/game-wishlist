import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getGameById, setPlaying } from "@/lib/games";

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
  const body = await req.json().catch(() => null);
  const playing = Boolean(body?.playing);

  try {
    await setPlaying(gameId, playing);
  } catch {
    return NextResponse.json(
      { error: "Spiel ist nicht aktiv" },
      { status: 409 }
    );
  }

  const updated = await getGameById(gameId);
  return NextResponse.json({ game: updated });
}
