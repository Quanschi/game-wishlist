import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import {
  getSteamId,
  listPrivateWishlist,
  refreshPrivateWishlist,
} from "@/lib/privateWishlist";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const steamId64 = await getSteamId(userId);
  if (!steamId64) {
    return NextResponse.json({ needsSteamId: true, items: [] });
  }

  await refreshPrivateWishlist(userId);
  const items = await listPrivateWishlist(userId);
  return NextResponse.json({ needsSteamId: false, items });
}
