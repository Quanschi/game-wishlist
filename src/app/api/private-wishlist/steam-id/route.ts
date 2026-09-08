import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { setSteamId } from "@/lib/privateWishlist";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const steamId64 = typeof body?.steamId64 === "string" ? body.steamId64.trim() : "";
  if (!/^\d{17}$/.test(steamId64)) {
    return NextResponse.json(
      { error: "Das sieht nicht nach einer gültigen SteamID64 aus (17-stellige Zahl)" },
      { status: 400 }
    );
  }

  await setSteamId(userId, steamId64);
  return NextResponse.json({ ok: true });
}
