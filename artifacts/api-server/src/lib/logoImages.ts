import { Storage } from "@google-cloud/storage";
import type { Response } from "express";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const LOGOS_PREFIX = "logos/";

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

export async function uploadLogoImage(type: "main" | "small", buffer: Buffer, contentType: string): Promise<void> {
  const file = gcs.bucket(getBucketId()).file(LOGOS_PREFIX + type);
  await file.save(buffer, { contentType, resumable: false });
}

export async function serveLogoImage(type: "main" | "small", res: Response): Promise<void> {
  const file = gcs.bucket(getBucketId()).file(LOGOS_PREFIX + type);
  const [exists] = await file.exists();
  if (!exists) {
    res.status(404).json({ error: "Logo not found" });
    return;
  }
  const [metadata] = await file.getMetadata();
  res.setHeader("Content-Type", (metadata.contentType as string) || "image/png");
  res.setHeader("Cache-Control", "public, max-age=300");
  if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
  file.createReadStream().pipe(res);
}

export async function logoExists(type: "main" | "small"): Promise<boolean> {
  const file = gcs.bucket(getBucketId()).file(LOGOS_PREFIX + type);
  const [exists] = await file.exists();
  return exists;
}
