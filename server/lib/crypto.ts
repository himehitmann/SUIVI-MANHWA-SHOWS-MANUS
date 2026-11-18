/**
 * Auth primitives with zero external dependencies (Node's built-in crypto).
 * Passwords use scrypt with a per-user salt; sessions are HMAC-signed tokens
 * with an expiry. All comparisons are timing-safe.
 */
import {
  createHmac,
  randomBytes,
  scryptSync,
  scrypt,
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

export class PasswordBusyError extends Error {
  readonly code = "auth_busy";
  readonly status = 503;
  constructor() { super("Password processing capacity exceeded"); this.name="PasswordBusyError"; }
}

// Bound both memory and queued work; leave libuv capacity for other operations.
export function createPasswordLimiter(concurrency=2,maxQueue=32) {
  if(!Number.isInteger(concurrency)||concurrency<1||!Number.isInteger(maxQueue)||maxQueue<0)throw Error("invalid_password_capacity");
  let active=0;
  const queue:Array<()=>void>=[];
  return function run<T>(work:()=>Promise<T>):Promise<T> {
    if(active>=concurrency&&queue.length>=maxQueue)return Promise.reject(new PasswordBusyError());
    return new Promise<T>((resolve,reject)=>{
      const release=()=>{active--;queue.shift()?.();};
      const start=()=>{active++;void Promise.resolve().then(work).then(value=>{release();resolve(value);},error=>{release();reject(error);});};
      if(active<concurrency)start();else queue.push(start);
    });
  };
}
const runPasswordJob=createPasswordLimiter();
function derivePassword(password:string,salt:Buffer):Promise<Buffer> {
  return new Promise((resolve,reject)=>scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key)));
}
export function hashPasswordAsync(password:string):Promise<string> {
  return runPasswordJob(async()=>{const salt=randomBytes(16),key=await derivePassword(password,salt);return salt.toString("hex")+":"+key.toString("hex");});
}
export function verifyPasswordAsync(password:string,stored:string|null|undefined):Promise<boolean> {
  if(typeof stored!=="string"||!/^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(stored))return Promise.resolve(false);
  return runPasswordJob(async()=>{const actual=await derivePassword(password,Buffer.from(stored.slice(0,32),"hex"));return timingSafeEqual(Buffer.from(stored.slice(33),"hex"),actual);});
}

