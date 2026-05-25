import { Storage } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const PDF_PREFIX = "pdfs/";

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

export async function uploadPdf(
  type: "quotes" | "amendments",
  id: string,
  buffer: Buffer,
): Promise<string> {
  const storagePath = `${PDF_PREFIX}${type}/${id}.pdf`;
  const file = gcs.bucket(getBucketId()).file(storagePath);
  await file.save(buffer, { contentType: "application/pdf", resumable: false });
  return storagePath;
}

export async function downloadPdf(storagePath: string): Promise<Buffer | null> {
  const file = gcs.bucket(getBucketId()).file(storagePath);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buffer] = await file.download();
  return buffer;
}
