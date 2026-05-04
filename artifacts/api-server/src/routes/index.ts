import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import productsRouter from "./products";
import pitAdminRouter from "./pitAdmin";
import adminMediaRouter from "./adminMedia";
import alertConfigsRouter from "./adminAlertConfigs";
import statusPassRouter from "./adminStatusPass";
import quotesSyncRouter from "./quotesSync";
import adminQuotesRouter from "./adminQuotes";
import adminLogJournalRouter from "./adminLogJournal";
import { adminReleaseRouter, publicReleaseRouter } from "./adminRelease";

const router: IRouter = Router();

// ── Public / no-auth routes first ───────────────────────────────────────────
router.use(healthRouter);
router.use("/auth", authRouter);
router.use(alertConfigsRouter);
router.use(statusPassRouter);
router.use(productsRouter);
router.use(publicReleaseRouter);

// ── Authenticated user routes ────────────────────────────────────────────────
router.use(quotesSyncRouter);

// ── Admin routes (requireAdmin applied inside each router) ───────────────────
router.use("/admin", adminRouter);
router.use("/admin", pitAdminRouter);
router.use("/admin", adminMediaRouter);
router.use(adminQuotesRouter);
router.use(adminLogJournalRouter);
router.use("/admin", adminReleaseRouter);

export default router;
