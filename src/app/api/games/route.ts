import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { createGameRequest, listGames } from "@/lib/games";
import { getSteamAppDetails } from "@/lib/steam";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const tag = req.nextUrl.searchParams.get("tag") ?? undefined;
  const view = req.nextUrl.searchParams.get("view") ?? "active";

  const statuses =
    view === "completed" ? (["completed"] as const) : (["active"] as const);

  const games = await listGames({ statuses: [...statuses], search, tag });
  return NextResponse.json({ games });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const appid = Number(body?.appid);
  if (!appid || Number.isNaN(appid)) {
    return NextResponse.json({ error: "Ungültige App-ID" }, { status: 400 });
  }

  const details = await getSteamAppDetails(appid);
  if (!details) {
    return NextResponse.json(
      { error: "Spiel konnte nicht von Steam geladen werden" },
      { status: 404 }
    );
  }

  try {
    const game = await createGameRequest(details, userId);
    return NextResponse.json({ game });
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICATE") {
      return NextResponse.json(
        { error: "Dieses Spiel steht bereits auf der Liste" },
        { status: 409 }
      );
    }
    throw err;
  }
}
