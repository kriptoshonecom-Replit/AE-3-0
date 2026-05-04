import path from "path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { serveProductImage } from "./lib/productImages";
import { migrateFilesystemImages } from "./lib/startupMigration";
import { pool } from "@workspace/db";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve product images: new images come from GCS (shared between dev & prod).
// Legacy images that were stored on the local filesystem before the GCS migration
// are still served as a fallback so existing references keep working.
const legacyUploadsDir = path.join(process.cwd(), "uploads");
const legacyPublicDir  = path.join(process.cwd(), "../quote-builder/public");

app.get("/api/images/products/:slug", async (req, res, next) => {
  try {
    await serveProductImage(req.params.slug, res);
  } catch (err) {
    // Fall through to legacy filesystem fallback
    next(err);
  }
});

app.use("/api/images", express.static(legacyUploadsDir, { maxAge: "7d" }));
app.use("/api/images", express.static(legacyPublicDir,  { maxAge: "7d" }));

app.use("/api", router);

// Create sessions + login_events tables if they don't exist yet (idempotent)
pool.query(`
  CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    email TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`).catch((err: unknown) => logger.warn(err, "session table migration failed"));

// Run filesystem-to-GCS migration in background on startup (idempotent — safe to re-run)
migrateFilesystemImages(process.cwd()).catch((err) =>
  logger.warn(err, "startup-migration failed")
);

export default app;
