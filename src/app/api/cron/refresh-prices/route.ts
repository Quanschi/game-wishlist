import { NextRequest, NextResponse } from "next/server";
import { forceRefreshAllPrices } from "@/lib/games";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Nicht erlaubt" }, { status: 401 });
    }
  }

  await forceRefreshAllPrices();
  return NextResponse.json({ ok: true });
}
