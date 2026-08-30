import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { otherUser } from "@/lib/games";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ userId: null }, { status: 200 });
  }
  return NextResponse.json({ userId, otherUserId: otherUser(userId) });
}
