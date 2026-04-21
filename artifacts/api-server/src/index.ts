import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function bootstrapAdmin() {
  const bootstrapEmail = process.env["ADMIN_BOOTSTRAP_EMAIL"];
  if (!bootstrapEmail) return;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"));

    if (count === 0) {
      const [promoted] = await db
        .update(usersTable)
        .set({ role: "admin" })
        .where(eq(usersTable.email, bootstrapEmail.toLowerCase().trim()))
        .returning({ email: usersTable.email });

      if (promoted) {
        logger.info({ email: promoted.email }, "Admin bootstrap: promoted user to admin");
      } else {
        logger.warn({ email: bootstrapEmail }, "Admin bootstrap: user not found");
      }
    }
  } catch (err) {
    logger.error(err, "Admin bootstrap failed");
  }
}

bootstrapAdmin().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
