import { Storage } from "@google-cloud/storage";
import type { Response } from "express";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const GCS_PREFIX = "products/";

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

export async function uploadProductImage(slug: string, buffer: Buffer): Promise<void> {
  const file = gcs.bucket(getBucketId()).file(GCS_PREFIX + slug);
  await file.save(buffer, { contentType: "image/png", resumable: false });
}

export async function listProductImageSlugs(): Promise<string[]> {
  const [files] = await gcs.bucket(getBucketId()).getFiles({ prefix: GCS_PREFIX });
  return files.map((f) => f.name.slice(GCS_PREFIX.length)).filter(Boolean);
}

export async function deleteProductImage(slug: string): Promise<void> {
  const file = gcs.bucket(getBucketId()).file(GCS_PREFIX + slug);
  const [exists] = await file.exists();
  if (exists) await file.delete();
}

export async function moveProductImage(oldSlug: string, newSlug: string): Promise<void> {
  const bucket = gcs.bucket(getBucketId());
  const src = bucket.file(GCS_PREFIX + oldSlug);
  const [exists] = await src.exists();
  if (!exists) return;
  await src.copy(bucket.file(GCS_PREFIX + newSlug));
  await src.delete();
}

export async function serveProductImage(slug: string, res: Response): Promise<void> {
  const file = gcs.bucket(getBucketId()).file(GCS_PREFIX + slug);
  const [exists] = await file.exists();
  if (!exists) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const [metadata] = await file.getMetadata();
  res.setHeader("Content-Type", (metadata.contentType as string) || "image/png");
  res.setHeader("Cache-Control", "public, max-age=604800");
  if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
  file.createReadStream().pipe(res);
}
