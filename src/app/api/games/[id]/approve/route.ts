import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { decide, getGameById } from "@/lib/games";

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
  const type =
    body?.type === "complete"
      ? "complete"
      : body?.type === "remove"
        ? "remove"
        : "add";
  const decision = body?.decision === "rejected" ? "rejected" : "approved";

  const game = await getGameById(gameId);
  if (!game) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  const expectedStatus =
    type === "add"
      ? "pending_add"
      : type === "remove"
        ? "pending_remove"
        : "pending_complete";
  if (game.status !== expectedStatus) {
    return NextResponse.json(
      { error: "Diese Anfrage ist nicht mehr offen" },
      { status: 409 }
    );
  }

  await decide(gameId, type, userId, decision);
  const updated = await getGameById(gameId);
  return NextResponse.json({ game: updated });
}
