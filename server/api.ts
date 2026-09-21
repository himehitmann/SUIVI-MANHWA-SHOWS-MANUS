/**
 * Optional sync + auth API for Dasi. Mounted under /api. It is NOT required for
 * the extension or web app to work — it only powers cross-device sync and
 * subscriptions when the owner deploys it. Passwords are scrypt-hashed, sessions
 * are HMAC-signed tokens, and storage is behind a swappable interface.
 */
import { z } from "zod";
import { AccessError, createMemoryAccessStore, effectivePlan, effectiveRole, type AccessStore } from "./lib/access";
import {createCatalog} from "./lib/catalog";
import { randomBytes, randomUUID } from "node:crypto";
import express, { type Request, type Response, type Router } from "express";
import {
  hashPasswordAsync,
  PasswordBusyError,
  signToken,
  verifyPasswordAsync,
  verifyToken,
} from "./lib/crypto";
import { mergeBlobs, type SyncBlob } from "./lib/merge";
import { createStore, type Store } from "./lib/store";
import {
  applyPlanIntent,
  planFromPaddleEvent,
  planFromStripeEvent,
  verifyPaddleSignature,
  verifyStripeSignature,
  type PriceMap,
} from "./lib/billing";

// Session-signing secret. Fail closed in production: a known/guessable secret
// would let anyone forge a valid token for any account. In dev we fall back to
// a random per-process secret (never a hardcoded one) so local runs work.
const SECRET = (() => {
  const s = process.env.SYNC_JWT_SECRET;
  if (s && s.length >= 32 && !/change.me|example|your.secret/i.test(s))
    return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SYNC_JWT_SECRET must be set to a strong value (>= 32 chars) in production."
    );
  }
  return randomBytes(32).toString("hex");
})();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const STRIPE_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const PADDLE_SECRET = process.env.PADDLE_WEBHOOK_SECRET || "";
const STRIPE_PRICES: PriceMap = {
  proMonth: process.env.STRIPE_PRICE_PRO_MONTH,
  proYear: process.env.STRIPE_PRICE_PRO_YEAR,
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
};
const PADDLE_PRICES: PriceMap = {
  proMonth: process.env.PADDLE_PRICE_PRO_MONTH,
  proYear: process.env.PADDLE_PRICE_PRO_YEAR,
  lifetime: process.env.PADDLE_PRICE_LIFETIME,
};

const rawBody = (req: Request): string =>
  Buffer.isBuffer(req.body)
    ? req.body.toString("utf8")
    : String(req.body ?? "");

const syncItem = z
  .object({
    id: z.string().min(1).max(256),
    updatedAt: z.number().finite().nonnegative().optional(),
  })
  .passthrough();
const syncInput = z.object({
  items: z.array(syncItem).max(20000),
  lists: z.array(syncItem).max(2000).optional(),
  sites: z.array(syncItem).max(2000).optional(),
  notifications: z.array(syncItem).max(2000).optional(),
  tombstones: z
    .array(
      z.object({
        kind: z.enum(["items", "lists", "sites", "notifications"]),
        id: z.string().min(1).max(256),
        deletedAt: z.number().finite().nonnegative(),
      })
    )
    .max(50000)
    .optional(),
  profile:z.object({name:z.string().max(100).optional(),bio:z.string().max(2000).optional(),avatar:z.string().max(1500000).optional(),banner:z.string().max(2000000).optional(),updatedAt:z.number().finite().nonnegative().optional()}).optional(),
  learn: z.unknown().optional(),
  updatedAt: z.number().finite().nonnegative().optional(),
});
const asyncRoute =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };


export function createRequestLimiter(now=()=>Date.now(),capacity=10000) {
  const hits=new Map<string,{n:number;expires:number}>();
  let sweptAt=0;
  return {
    size:()=>hits.size,
    check(key:string,max:number,windowMs=60000) {
      const time=now();
      if(time-sweptAt>=30000||hits.size>=capacity){for(const [id,record] of hits)if(record.expires<=time)hits.delete(id);sweptAt=time;}
      let record=hits.get(key);
      if(record&&record.expires<=time){hits.delete(key);record=undefined;}
      if(!record) {
        if(hits.size>=capacity)return {allowed:false,retryAfter:30};
        record={n:0,expires:time+windowMs};hits.set(key,record);
      }
      record.n++;
      return {allowed:record.n<=max,retryAfter:Math.max(1,Math.ceil((record.expires-time)/1000))};
    },
  };
}

export function createApiRouter(
  store: Store = createStore(process.env.SYNC_DB_FILE),
  access: AccessStore = createMemoryAccessStore(),
  owners: ReadonlySet<string> = new Set((process.env.YOMU_OWNER_IDS || "").split(",").map(s=>s.trim()).filter(Boolean))
): Router {
  const router = express.Router();
  const limiter=createRequestLimiter();
  const rateLimited=(req:Request,res:Response,max=20,windowMs=60000,scope?:string):boolean=>{
    const route=req.path.toLowerCase().replace(/\/+$/,"");
    const result=limiter.check(scope||route+":"+(req.ip||req.socket.remoteAddress||"unknown"),max,windowMs);
    if(result.allowed)return false;
    res.setHeader("Retry-After",String(result.retryAfter));res.status(429).json({error:"too_many_requests"});return true;
  };
  // Private bodies and credential errors must never be reused by browser/proxy caches.
  // Apply before parsers as malformed or oversized bodies are private responses too.
  router.use((req,res,next)=>{
    res.setHeader("Cache-Control","no-store");res.setHeader("Pragma","no-cache");
    res.setHeader("X-Content-Type-Options","nosniff");res.vary("Origin");
    if(rateLimited(req,res,300,60000,"api:"+(req.ip||req.socket.remoteAddress||"unknown")))return;
    next();
  });

  // Webhooks must see the RAW request body to verify provider signatures, so
  // they are mounted before the JSON parser. Each is a no-op (503) until its
  // signing secret is configured, so an undeployed billing setup is inert.
  router.post(
    "/webhooks/stripe",
    express.raw({ type: "*/*" }),
    asyncRoute(async (req: Request, res: Response) => {
      if (!STRIPE_SECRET)
        return res.status(503).json({ error: "billing_disabled" });
      const raw = rawBody(req);
      const sig = String(req.headers["stripe-signature"] || "");
      if (!verifyStripeSignature(raw, sig, STRIPE_SECRET))
        return res.status(400).json({ error: "bad_signature" });
      let event: unknown;
      try {
        event = JSON.parse(raw);
      } catch {
        return res.status(400).json({ error: "invalid_json" });
      }
      const result = await applyPlanIntent(
        store,
        planFromStripeEvent(event, STRIPE_PRICES)
      );
      return res.json({
        received: true,
        applied: result.ok,
        plan: result.plan,
      });
    })
  );

  router.post(
    "/webhooks/paddle",
    express.raw({ type: "*/*" }),
    asyncRoute(async (req: Request, res: Response) => {
      if (!PADDLE_SECRET)
        return res.status(503).json({ error: "billing_disabled" });
      const raw = rawBody(req);
      const sig = String(req.headers["paddle-signature"] || "");
      if (!verifyPaddleSignature(raw, sig, PADDLE_SECRET))
        return res.status(400).json({ error: "bad_signature" });
      let event: unknown;
      try {
        event = JSON.parse(raw);
      } catch {
        return res.status(400).json({ error: "invalid_json" });
      }
      const result = await applyPlanIntent(
        store,
        planFromPaddleEvent(event, PADDLE_PRICES)
      );
      return res.json({
        received: true,
        applied: result.ok,
        plan: result.plan,
      });
    })
  );

  router.use(express.json({ limit: "2mb" }));

  // CORS: the extension and web app call this from another origin.
  router.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = new Set(
      (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
    );
    const sameOrigin = origin === req.protocol + "://" + req.get("host");
    if (origin && !sameOrigin && !allowed.has(origin))
      return res.status(403).json({ error: "origin_not_allowed" });
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.vary("Origin");
    }
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  const auth = async (
    req: Request
  ): Promise<{ id: string; sessionId: string } | null> => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = verifyToken(token, SECRET);
    if (!payload || typeof payload.jti !== "string") return null;
    const session = await store.getSession(payload.jti);
    return session?.userId === payload.sub
      ? { id: payload.sub, sessionId: session.id }
      : null;
  };

  const issueToken = async (userId: string) => {
    const id = randomUUID(),
      now = Date.now();
    await store.createSession({
      id,
      userId,
      createdAt: now,
      expiresAt: now + 30 * 86400000,
    });
    return signToken({ sub: userId, jti: id }, SECRET);
  };
  const catalog=createCatalog();
  router.get('/catalog',asyncRoute(async(req,res)=>{
    if(rateLimited(req,res,60))return;
    if(typeof req.query.q!=='string'||req.query.q.length<2||req.query.q.length>160)return res.status(400).json({error:'invalid_query'});
    const result=await catalog(req.query.q);return res.status(result.sources.some(s=>s.ok)?200:503).json(result);
  }));
  const accountView = async (u: { id: string; email: string; plan: "free"|"pro"|"lifetime" }) => {
    const rights = await access.get(u.id);
    return {id:u.id,email:u.email,plan:effectivePlan(u.plan,u.id,rights,owners),role:effectiveRole(u.id,rights,owners),giftUntil:rights.giftUntil,accessVersion:rights.version};
  };
  const adminSession = async (req:Request,res:Response) => {
    const session=await auth(req);
    if(!session){res.status(401).json({error:"unauthorized"});return null;}
    if(rateLimited(req,res,30,60000,"admin:"+session.id))return null;
    const user=await store.getUserById(session.id);
    if(!user || effectiveRole(user.id,await access.get(user.id),owners)==="member") {res.status(403).json({error:"admin_required"});return null;}
    return {session,user};
  };
  router.get("/admin/me",asyncRoute(async(req,res)=>{
    const admin=await adminSession(req,res);if(!admin)return;
    return res.json({user:await accountView(admin.user)});
  }));
  router.post("/admin/lookup",asyncRoute(async(req,res)=>{
    const admin=await adminSession(req,res);if(!admin)return;
    const email=req.body?.email;
    if(typeof email!=="string"||email.length>254||!EMAIL_RE.test(email))return res.status(400).json({error:"invalid_email"});
    const user=await store.getUserByEmail(email);
    if(!user)return res.status(404).json({error:"account_not_found"});
    return res.json({user:await accountView(user)});
  }));
  router.get("/admin/audit",asyncRoute(async(req,res)=>{
    if(!await adminSession(req,res))return;
    return res.json({events:await access.audit()});
  }));
  const adminChange=z.object({targetId:z.string().min(1).max(128),requestId:z.string().uuid(),expectedVersion:z.number().int().nonnegative(),kind:z.enum(["role","gift"]),role:z.enum(["member","admin"]).optional(),days:z.number().int().min(0).max(366).optional(),reason:z.string().trim().min(3).max(200),current:z.string().min(1).max(1024)}).strict();
  router.post("/admin/access",asyncRoute(async(req,res)=>{
    const admin=await adminSession(req,res);if(!admin)return;
    if(rateLimited(req,res,10,60000,"admin-write:"+admin.user.id))return;
    const parsed=adminChange.safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:"invalid_admin_change"});
    const {targetId,current,...change}=parsed.data;
    if(change.kind==="role"?(change.role===undefined||change.days!==undefined):(change.days===undefined||change.role!==undefined))return res.status(400).json({error:"invalid_admin_change"});
    if(!await verifyPasswordAsync(current,admin.user.passwordHash))return res.status(401).json({error:"invalid_credentials"});
    if(!await store.getUserById(targetId))return res.status(404).json({error:"account_not_found"});
    const result=await access.change(admin.user.id,targetId,change,owners,async connection=>{
      if(connection){
        const result=await connection.query("SELECT u.id FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.id=$1 AND u.password_hash=$2 AND s.id=$3 AND s.expires_at>$4 FOR SHARE OF u,s",[admin.user.id,admin.user.passwordHash,admin.session.sessionId,Date.now()]);
        return result.rows.length===1;
      }
      const live=await store.getSession(admin.session.sessionId),user=await store.getUserById(admin.user.id);
      return live?.userId===admin.user.id&&user?.passwordHash===admin.user.passwordHash&&!!await store.getUserById(targetId);
    });
    return res.json({ok:true,access:result});
  }));

  router.post(
    "/auth/signup",
    asyncRoute(async (req: Request, res: Response) => {
      if (rateLimited(req, res, 10)) return;
      const { email, password } = req.body || {};
      if (
        typeof email !== "string" ||
        email.length > 254 ||
        !EMAIL_RE.test(email)
      )
        return res.status(400).json({ error: "invalid_email" });
      if (
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 1024
      )
        return res.status(400).json({ error: "weak_password" });
      if (await store.getUserByEmail(email))
        return res.status(409).json({ error: "email_taken" });
      const user = {
        id: randomUUID(),
        email,
        passwordHash: await hashPasswordAsync(password),
        plan: "free" as const,
        createdAt: Date.now(),
      };
      await store.createUser(user);
      return res.json({
        token: await issueToken(user.id),
        user: await accountView(user),
      });
    })
  );

  router.post(
    "/auth/login",
    asyncRoute(async (req: Request, res: Response) => {
      if (rateLimited(req, res, 10)) return;
      const { email, password } = req.body || {};
      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        password.length > 1024
      )
        return res.status(400).json({ error: "invalid_credentials" });
      const user = await store.getUserByEmail(email);
      if (!user || !(await verifyPasswordAsync(password || "", user.passwordHash)))
        return res.status(401).json({ error: "invalid_credentials" });
      return res.json({
        token: await issueToken(user.id),
        user: await accountView(user),
      });
    })
  );

  // Change the signed-in user's email (must be unique).
  router.post(
    "/auth/email",
    asyncRoute(async (req: Request, res: Response) => {
      const session = await auth(req);
      if (!session) return res.status(401).json({ error: "unauthorized" });
      const { email, current } = req.body || {};
      if (
        typeof email !== "string" ||
        email.length > 254 ||
        !EMAIL_RE.test(email)
      )
        return res.status(400).json({ error: "invalid_email" });
      const user = await store.getUserById(session.id);
      if (!user) return res.status(401).json({ error: "unauthorized" });
      if (rateLimited(req, res, 10)) return;
      if (
        typeof current !== "string" ||
        current.length > 1024 ||
        !(await verifyPasswordAsync(current, user.passwordHash))
      )
        return res.status(401).json({ error: "invalid_credentials" });
      const clash = await store.getUserByEmail(email);
      if (clash && clash.id !== user.id)
        return res.status(409).json({ error: "email_taken" });
      await store.updateUser({ ...user, email });
      return res.json({ user: await accountView({ ...user, email }) });
    })
  );

  // Change the signed-in user's password (requires the current one).
  router.post(
    "/auth/password",
    asyncRoute(async (req: Request, res: Response) => {
      if (rateLimited(req, res, 10)) return;
      const session = await auth(req);
      if (!session) return res.status(401).json({ error: "unauthorized" });
      const { current, next } = req.body || {};
      if (
        typeof current !== "string" ||
        current.length > 1024 ||
        typeof next !== "string" ||
        next.length < 8 ||
        next.length > 1024
      )
        return res.status(400).json({ error: "weak_password" });
      const user = await store.getUserById(session.id);
      if (!user) return res.status(401).json({ error: "unauthorized" });
      if (!(await verifyPasswordAsync(current || "", user.passwordHash)))
        return res.status(401).json({ error: "invalid_credentials" });
      await store.updateUser({ ...user, passwordHash: await hashPasswordAsync(next) });
      await store.revokeUserSessions(user.id);
      return res.json({ ok: true, token: await issueToken(user.id) });
    })
  );

  router.post(
    "/auth/logout",
    asyncRoute(async (req, res) => {
      const session = await auth(req);
      if (session) await store.revokeSession(session.sessionId);
      return res.json({ ok: true });
    })
  );
  router.post(
    "/auth/logout-all",
    asyncRoute(async (req, res) => {
      const session = await auth(req);
      if (!session) return res.status(401).json({ error: "unauthorized" });
      await store.revokeUserSessions(session.id);
      return res.json({ ok: true });
    })
  );
  router.post(
    "/auth/delete",
    asyncRoute(async (req, res) => {
      if (rateLimited(req, res, 5)) return;
      const session = await auth(req);
      if (!session) return res.status(401).json({ error: "unauthorized" });
      const user = await store.getUserById(session.id),
        current = req.body?.current;
      if (
        !user ||
        typeof current !== "string" ||
        current.length > 1024 ||
        !(await verifyPasswordAsync(current, user.passwordHash))
      )
        return res.status(401).json({ error: "invalid_credentials" });
      if(owners.has(session.id))return res.status(409).json({error:"owner_account_protected"});
      await store.deleteUser(session.id);
      return res.json({ ok: true });
    })
  );

  router.get(
    "/me",
    asyncRoute(async (req: Request, res: Response) => {
      const session = await auth(req);
      if (!session) return res.status(401).json({ error: "unauthorized" });
      const user = await store.getUserById(session.id);
      if (!user) return res.status(401).json({ error: "unauthorized" });
      return res.json({ user: await accountView(user) });
    })
  );

  // License/subscription status — decoupled from extension version; a real
  // deployment sets user.plan from the payment provider webhook (Paddle/Stripe).
  router.get(
    "/license",
    asyncRoute(async (req: Request, res: Response) => {
      const session = await auth(req);
      if (!session) return res.status(401).json({ error: "unauthorized" });
      const user = await store.getUserById(session.id);
      if(!user)return res.status(401).json({error:"unauthorized"});
      return res.json({plan:(await accountView(user)).plan});
    })
  );

  router.get(
    "/sync",
    asyncRoute(async (req: Request, res: Response) => {
      const session = await auth(req);
      if (!session) return res.status(401).json({ error: "unauthorized" });
      if(rateLimited(req,res,120,60000,"sync:"+session.id))return;
      const record = await store.getSync(session.id);
      return res.json({
        blob: record?.blob ? {...record.blob,plan:(await accountView((await store.getUserById(session.id))!)).plan} : null,
        updatedAt: record?.updatedAt ?? 0,
      });
    })
  );

  router.put(
    "/sync",
    asyncRoute(async (req: Request, res: Response) => {
      const session = await auth(req);
      if (!session) return res.status(401).json({ error: "unauthorized" });
      if(rateLimited(req,res,120,60000,"sync:"+session.id))return;
      const parsed = syncInput.safeParse(req.body?.blob);
      if (!parsed.success)
        return res.status(400).json({
          error: "invalid_blob",
          message: "Library records must contain a valid id and timestamp.",
        });
      const user = await store.getUserById(session.id);
      if (!user) return res.status(401).json({ error: "unauthorized" });
      const incoming = {
        ...parsed.data,
        plan: user.plan,
        updatedAt: parsed.data.updatedAt || Date.now(),
      } as SyncBlob;
      const record = await store.mergeSync(session.id, incoming);
      const merged = {...record.blob,plan:(await accountView(user)).plan};
      return res.json({ blob: merged, updatedAt: merged.updatedAt });
    })
  );

  router.use(
    (
      error: unknown,
      _req: Request,
      res: Response,
      _next: express.NextFunction
    ) => {
      if(error instanceof AccessError)return res.status(error.status).json({error:error.code});
      if(error instanceof PasswordBusyError){res.setHeader("Retry-After","2");return res.status(503).json({error:"auth_busy"});}
      if(error instanceof Error&&error.message==="catalog_busy"){res.setHeader("Retry-After","5");return res.status(503).json({error:"catalog_busy"});}
      const status = (error as { status?: number }).status;
      res.status(status && status >= 400 && status < 500 ? status : 500).json({
        error: status === 413 ? "payload_too_large" : "request_failed",
      });
    }
  );
  return router;
}
