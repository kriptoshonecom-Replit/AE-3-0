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

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/admin", pitAdminRouter);
router.use("/admin", adminMediaRouter);
router.use(alertConfigsRouter);
router.use(statusPassRouter);
router.use(productsRouter);
router.use(quotesSyncRouter);
router.use(adminQuotesRouter);

export default router;
