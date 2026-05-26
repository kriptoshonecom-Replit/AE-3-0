import { Storage, type StorageOptions } from "@google-cloud/storage";
import { createWriteStream, mkdirSync } from "fs";
import { pipeline } from "stream/promises";
import path from "path";

const SIDECAR = "http://127.0.0.1:1106";
const GCS_PREFIX = "products/";
const OUT_DIR = path.resolve(import.meta.dirname, "../../exported-images");

const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
if (!bucketId) {
  console.error("DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
  process.exit(1);
}

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
  } as StorageOptions["credentials"],
  projectId: "",
});

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const bucket = gcs.bucket(bucketId!);
  const [files] = await bucket.getFiles({ prefix: GCS_PREFIX });

  if (files.length === 0) {
    console.log("No product images found in bucket.");
    return;
  }

  console.log(`Found ${files.length} image(s). Downloading to ${OUT_DIR} …`);

  let ok = 0;
  let fail = 0;

  for (const file of files) {
    const slug = file.name.slice(GCS_PREFIX.length);
    if (!slug) continue;
    const dest = path.join(OUT_DIR, slug);
    try {
      const readStream = file.createReadStream();
      const writeStream = createWriteStream(dest);
      await pipeline(readStream, writeStream);
      console.log(`  ✓  ${slug}`);
      ok++;
    } catch (err) {
      console.error(`  ✗  ${slug}:`, err instanceof Error ? err.message : err);
      fail++;
    }
  }

  console.log(`\nDone — ${ok} saved, ${fail} failed.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
