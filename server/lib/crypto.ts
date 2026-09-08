/**
 * Auth primitives with zero external dependencies (Node's built-in crypto).
 * Passwords use scrypt with a per-user salt; sessions are HMAC-signed tokens
 * with an expiry. All comparisons are timing-safe.
 */
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = (stored || "").split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

export interface TokenPayload {
  sub: string; // user id
  exp: number; // unix seconds
  [k: string]: unknown;
}

export function signToken(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds = 60 * 60 * 24 * 30
): string {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const data = b64url(JSON.stringify(body));
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(
  token: string,
  secret: string
): TokenPayload | null {
  const parts = (token || "").split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;
  const expected = createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf))
    return null;
  try {
    const body = JSON.parse(
      Buffer.from(data, "base64url").toString()
    ) as TokenPayload;
    if (
      typeof body.sub !== "string" ||
      !body.sub ||
      !Number.isFinite(body.exp) ||
      body.exp <= Math.floor(Date.now() / 1000)
    )
      return null;
    return body;
  } catch {
    return null;
  }
}
