import path from "path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { serveProductImage } from "./lib/productImages";
import { migrateFilesystemImages } from "./lib/startupMigration";

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

// Run filesystem-to-GCS migration in background on startup (idempotent — safe to re-run)
migrateFilesystemImages(process.cwd()).catch((err) =>
  logger.warn(err, "startup-migration failed")
);

export default app;
