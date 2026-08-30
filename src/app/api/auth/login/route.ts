import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyCredentials,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!userId || !password) {
    return NextResponse.json(
      { error: "Benutzername und Passwort erforderlich" },
      { status: 400 }
    );
  }

  const ok = await verifyCredentials(userId, password);
  if (!ok) {
    return NextResponse.json(
      { error: "Ungültige Zugangsdaten" },
      { status: 401 }
    );
  }

  const token = await createSessionToken(userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
