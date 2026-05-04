import { Storage } from "@google-cloud/storage";
import { logger } from "./logger";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const CATALOG_GCS_PATH = "catalog/products.json";

function getBucketId(): string {
  const id = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!id) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
  return id;
}

const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export async function readCatalogFromGCS(): Promise<unknown | null> {
  try {
    const file = gcs.bucket(getBucketId()).file(CATALOG_GCS_PATH);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    return JSON.parse(buf.toString("utf8"));
  } catch (err) {
    logger.warn({ err }, "catalogSync: failed to read from GCS, falling back to DB");
    return null;
  }
}

export async function writeCatalogToGCS(data: unknown): Promise<void> {
  try {
    const file = gcs.bucket(getBucketId()).file(CATALOG_GCS_PATH);
    await file.save(JSON.stringify(data), {
      contentType: "application/json",
      resumable: false,
    });
  } catch (err) {
    logger.warn({ err }, "catalogSync: failed to write to GCS — DB was still updated");
  }
}
