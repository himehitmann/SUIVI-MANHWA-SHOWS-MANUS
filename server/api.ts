/**
 * Optional sync + auth API for Dasi. Mounted under /api. It is NOT required for
 * the extension or web app to work — it only powers cross-device sync and
 * subscriptions when the owner deploys it. Passwords are scrypt-hashed, sessions
 * are HMAC-signed tokens, and storage is behind a swappable interface.
 */
import { randomUUID } from "node:crypto";
import express, { type Request, type Response, type Router } from "express";
import { hashPassword, signToken, verifyPassword, verifyToken } from "./lib/crypto";
import { mergeBlobs, type SyncBlob } from "./lib/merge";
import { createStore, type Store } from "./lib/store";

const SECRET = process.env.SYNC_JWT_SECRET || "dev-insecure-secret-change-me";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function createApiRouter(store: Store = createStore(process.env.SYNC_DB_FILE)): Router {
  const router = express.Router();
  router.use(express.json({ limit: "2mb" }));

  // CORS: the extension and web app call this from another origin.
  router.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  const auth = (req: Request): { id: string } | null => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = verifyToken(token, SECRET);
    return payload ? { id: payload.sub } : null;
  };

  const publicUser = (u: { id: string; email: string; plan: string }) => ({ id: u.id, email: u.email, plan: u.plan });

  router.post("/auth/signup", async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!EMAIL_RE.test(email || "")) return res.status(400).json({ error: "invalid_email" });
    if (typeof password !== "string" || password.length < 8) return res.status(400).json({ error: "weak_password" });
    if (await store.getUserByEmail(email)) return res.status(409).json({ error: "email_taken" });
    const user = { id: randomUUID(), email, passwordHash: hashPassword(password), plan: "free" as const, createdAt: Date.now() };
    await store.createUser(user);
    return res.json({ token: signToken({ sub: user.id }, SECRET), user: publicUser(user) });
  });

  router.post("/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    const user = await store.getUserByEmail(email || "");
    if (!user || !verifyPassword(password || "", user.passwordHash)) return res.status(401).json({ error: "invalid_credentials" });
    return res.json({ token: signToken({ sub: user.id }, SECRET), user: publicUser(user) });
  });

  router.get("/me", async (req: Request, res: Response) => {
    const session = auth(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });
    const user = await store.getUserById(session.id);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    return res.json({ user: publicUser(user) });
  });

  // License/subscription status — decoupled from extension version; a real
  // deployment sets user.plan from the payment provider webhook (Paddle/Stripe).
  router.get("/license", async (req: Request, res: Response) => {
    const session = auth(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });
    const user = await store.getUserById(session.id);
    return res.json({ plan: user?.plan ?? "free" });
  });

  router.get("/sync", async (req: Request, res: Response) => {
    const session = auth(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });
    const record = await store.getSync(session.id);
    return res.json({ blob: record?.blob ?? null, updatedAt: record?.updatedAt ?? 0 });
  });

  router.put("/sync", async (req: Request, res: Response) => {
    const session = auth(req);
    if (!session) return res.status(401).json({ error: "unauthorized" });
    const incoming = req.body?.blob as SyncBlob | undefined;
    if (!incoming || !Array.isArray(incoming.items)) return res.status(400).json({ error: "invalid_blob" });
    const existing = await store.getSync(session.id);
    const merged = mergeBlobs(existing?.blob ?? null, { ...incoming, updatedAt: incoming.updatedAt || Date.now() });
    await store.setSync(session.id, { blob: merged, updatedAt: merged.updatedAt });
    return res.json({ blob: merged, updatedAt: merged.updatedAt });
  });

  return router;
}
