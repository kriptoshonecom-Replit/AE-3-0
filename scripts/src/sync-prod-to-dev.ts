/**
 * sync-prod-to-dev.ts
 *
 * Copies all users and quotes from the production database into the
 * local development database using an upsert so it is safe to run
 * multiple times.
 *
 * Prerequisites
 * -------------
 * Set PROD_DATABASE_URL in your Replit secrets (Secrets tab → "PROD_DATABASE_URL").
 * The value is the production PostgreSQL connection string — find it in your
 * Replit deployment dashboard under "Database" or copy it from the production
 * environment variables.
 *
 * Usage
 * -----
 *   pnpm --filter @workspace/scripts run sync-prod-to-dev
 */

import pg from "pg";

const { Pool } = pg;

const PROD_URL = process.env.PROD_DATABASE_URL;
const DEV_URL = process.env.DATABASE_URL;

if (!PROD_URL) {
  console.error(
    "❌  PROD_DATABASE_URL is not set.\n" +
      "    Add it as a Replit secret: Secrets tab → PROD_DATABASE_URL\n" +
      "    Value: your production PostgreSQL connection string."
  );
  process.exit(1);
}
if (!DEV_URL) {
  console.error("❌  DATABASE_URL is not set (dev database missing).");
  process.exit(1);
}

const prod = new Pool({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false } });
const dev = new Pool({ connectionString: DEV_URL });

async function syncUsers() {
  const { rows } = await prod.query<{
    id: string;
    email: string;
    password_hash: string;
    full_name: string | null;
    created_at: string;
    role: string;
  }>(
    "SELECT id, email, password_hash, full_name, created_at, role FROM users ORDER BY created_at"
  );

  if (rows.length === 0) {
    console.log("  ↳ No users found in production.");
    return 0;
  }

  let upserted = 0;
  for (const u of rows) {
    await dev.query(
      `INSERT INTO users (id, email, password_hash, full_name, created_at, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         email        = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         full_name    = EXCLUDED.full_name,
         role         = EXCLUDED.role`,
      [u.id, u.email, u.password_hash, u.full_name, u.created_at, u.role]
    );
    upserted++;
  }
  return upserted;
}

async function syncQuotes() {
  const { rows } = await prod.query<{
    id: string;
    user_id: string;
    quote_number: string | null;
    company_name: string | null;
    customer_name: string | null;
    pass_status: string | null;
    updated_by_user_id: string | null;
    updated_by_name: string | null;
    data: unknown;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, user_id, quote_number, company_name, customer_name,
            pass_status, updated_by_user_id, updated_by_name,
            data, created_at, updated_at
     FROM quotes ORDER BY created_at`
  );

  if (rows.length === 0) {
    console.log("  ↳ No quotes found in production.");
    return 0;
  }

  let upserted = 0;
  for (const q of rows) {
    await dev.query(
      `INSERT INTO quotes
         (id, user_id, quote_number, company_name, customer_name,
          pass_status, updated_by_user_id, updated_by_name,
          data, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         quote_number       = EXCLUDED.quote_number,
         company_name       = EXCLUDED.company_name,
         customer_name      = EXCLUDED.customer_name,
         pass_status        = EXCLUDED.pass_status,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_by_name    = EXCLUDED.updated_by_name,
         data               = EXCLUDED.data,
         updated_at         = EXCLUDED.updated_at`,
      [
        q.id,
        q.user_id,
        q.quote_number,
        q.company_name,
        q.customer_name,
        q.pass_status,
        q.updated_by_user_id,
        q.updated_by_name,
        JSON.stringify(q.data),
        q.created_at,
        q.updated_at,
      ]
    );
    upserted++;
  }
  return upserted;
}

async function main() {
  console.log("🔄  Syncing production → development\n");

  try {
    console.log("👤  Syncing users…");
    const userCount = await syncUsers();
    console.log(`    ✅  ${userCount} user(s) upserted\n`);

    console.log("📋  Syncing quotes…");
    const quoteCount = await syncQuotes();
    console.log(`    ✅  ${quoteCount} quote(s) upserted\n`);

    console.log("✅  Sync complete.");
  } catch (err) {
    console.error("❌  Sync failed:", err);
    process.exit(1);
  } finally {
    await prod.end();
    await dev.end();
  }
}

main();
