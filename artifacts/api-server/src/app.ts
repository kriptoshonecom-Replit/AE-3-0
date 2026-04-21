import path from "path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

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

// Serve product images via the API server so the same URL path works in both
// development (Vite proxies /api to this server) and production (direct request).
//
// New uploads are stored in <api-server>/uploads/ and served at /api/images/*.
// Legacy images (written into quote-builder/public/ before this change) are also
// served here as a fallback so existing DB references don't break immediately.
const uploadsDir = path.join(process.cwd(), "uploads");
const legacyPublicDir = path.join(process.cwd(), "../quote-builder/public");

app.use("/api/images", express.static(uploadsDir, { maxAge: "7d" }));
app.use("/api/images", express.static(legacyPublicDir, { maxAge: "7d" }));

app.use("/api", router);

export default app;
