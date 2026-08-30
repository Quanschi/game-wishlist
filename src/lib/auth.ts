import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 Tage

export type SessionPayload = {
  userId: string;
};

type Account = {
  id: string;
  passwordHash: string;
};

function getAccounts(): Account[] {
  const accounts: Account[] = [];
  for (const n of [1, 2]) {
    const id = process.env[`AUTH_USER_${n}_ID`];
    // Base64-kodiert gespeichert, damit die "$"-Zeichen im bcrypt-Hash nicht
    // von Next.js' dotenv-expand als Variablenreferenz interpretiert werden.
    const encodedHash = process.env[`AUTH_USER_${n}_PASSWORD_HASH_B64`];
    if (id && encodedHash) {
      accounts.push({
        id,
        passwordHash: Buffer.from(encodedHash, "base64").toString("utf8"),
      });
    }
  }
  return accounts;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET fehlt oder ist zu kurz. Bitte in .env.local setzen."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function verifyCredentials(
  userId: string,
  password: string
): Promise<boolean> {
  const accounts = getAccounts();
  console.log(
    "[login-debug] Versuch für userId=%s | bekannte Accounts=%o | eingegebene userId Länge=%d",
    JSON.stringify(userId),
    accounts.map((a) => ({ id: a.id, hashPrefix: a.passwordHash.slice(0, 4) })),
    userId.length
  );
  const account = accounts.find((a) => a.id === userId);
  if (!account) {
    console.log("[login-debug] Kein Account mit dieser userId gefunden");
    return false;
  }
  const ok = await bcrypt.compare(password, account.passwordHash);
  console.log("[login-debug] bcrypt.compare Ergebnis=%s (Passwort-Länge=%d)", ok, password.length);
  return ok;
}

export function getOtherUserId(userId: string): string | null {
  const accounts = getAccounts();
  const other = accounts.find((a) => a.id !== userId);
  return other?.id ?? null;
}

export function isKnownUser(userId: string): boolean {
  return getAccounts().some((a) => a.id === userId);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ userId } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.userId === "string") {
      return { userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
