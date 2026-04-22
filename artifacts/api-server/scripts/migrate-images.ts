import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Storage } from "@google-cloud/storage";
import { db } from "@workspace/db";
import { mediaFilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SIDECAR = "http://127.0.0.1:1106";
const GCS_PREFIX = "products/";

const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
if (!bucketId) { console.error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set"); process.exit(1); }

const imageDirs = [
  join(__dirname, "../../quote-builder/public/products"),
  join(__dirname, "../uploads/products"),
];

let migrated = 0;
let skipped = 0;
let errors = 0;

for (const dir of imageDirs) {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    console.log(`Skipping ${dir} (not found)`);
    continue;
  }

  const pngFiles = files.filter((f) => f.toLowerCase().endsWith(".png"));
  console.log(`\nProcessing ${pngFiles.length} PNG files from ${dir}`);

  for (const filename of pngFiles) {
    try {
      const gcsFile = gcs.bucket(bucketId).file(GCS_PREFIX + filename);
      const [exists] = await gcsFile.exists();

      if (!exists) {
        const buffer = await readFile(join(dir, filename));
        await gcsFile.save(buffer, { contentType: "image/png", resumable: false });
        console.log(`  ↑ Uploaded to GCS: ${filename}`);
      } else {
        console.log(`  ✓ Already in GCS: ${filename}`);
      }

      const existing = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.slug, filename)).limit(1);
      if (existing.length === 0) {
        await db.insert(mediaFilesTable).values({
          originalName: filename,
          slug: filename,
          path: `/api/images/products/${filename}`,
        }).onConflictDoNothing();
        console.log(`  + Registered in DB: ${filename}`);
        migrated++;
      } else {
        console.log(`  ✓ Already in DB: ${filename}`);
        skipped++;
      }
    } catch (err) {
      console.error(`  ✗ Error processing ${filename}:`, (err as Error).message);
      errors++;
    }
  }
}

console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`);
process.exit(0);
