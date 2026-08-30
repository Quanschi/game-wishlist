import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { listPendingForUser } from "@/lib/games";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const games = await listPendingForUser(userId);
  return NextResponse.json({ games });
}
