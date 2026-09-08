import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createApiRouter } from "./api";
import { createStore, type Store } from "./lib/store";
import {
  createPostgresStore,
  ensureSchema,
  type SqlClient,
} from "./lib/store-postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Choose the storage backend from the environment: Postgres in production
 * (DATABASE_URL set), otherwise the dev/self-host file store. `pg` is imported
 * dynamically via a non-literal specifier so it stays an optional dependency —
 * it is only required when DATABASE_URL is actually configured.
 */
async function resolveStore(): Promise<Store> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production" && !process.env.SYNC_DB_FILE)
      throw new Error(
        "Configure DATABASE_URL or persistent SYNC_DB_FILE before serving accounts."
      );
    return createStore(process.env.SYNC_DB_FILE);
  }
  const pgModule = "pg";
  const pg = (await import(pgModule)) as {
    Pool: new (
      cfg: Record<string, unknown>
    ) => SqlClient & { end?: () => Promise<void> };
  };
  const pool = new pg.Pool({
    connectionString: url,
    ...(process.env.DATABASE_SSL === "false"
      ? {}
      : { ssl: { rejectUnauthorized: true } }),
  });
  const store = createPostgresStore(pool);
  await ensureSchema(pool);
  console.log("Using Postgres store");
  return store;
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Baseline security headers (no external dependency). Don't leak the stack,
  // block MIME sniffing and clickjacking, and keep referrers tight.
  app.disable("x-powered-by");
  app.set(
    "trust proxy",
    process.env.TRUST_PROXY_HOPS ? Number(process.env.TRUST_PROXY_HOPS) : false
  );
  const isProd = process.env.NODE_ENV === "production";
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://graphql.anilist.co; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()"
    );
    // Force HTTPS in production when terminated by a proxy (opt-out via FORCE_HTTPS=false).
    if (
      isProd &&
      process.env.FORCE_HTTPS !== "false" &&
      req.headers["x-forwarded-proto"] === "http"
    ) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
      return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    }
    if (isProd)
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    next();
  });

  // Health check for load balancers / uptime monitors.
  app.get("/healthz", (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // Optional sync + auth API. Harmless when unused; the apps default to local.
  app.use("/api", createApiRouter(await resolveStore()));

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
