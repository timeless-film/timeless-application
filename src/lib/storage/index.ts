export interface StorageResult {
  /** URL to access the file (relative for local, absolute for S3) */
  url: string;
  /** Generated filename (e.g. "a1b2c3d4.jpg") */
  filename: string;
}

/**
 * Upload a file buffer to the configured storage backend.
 * - Local (default): writes to `./uploads/` directory
 * - S3 (STORAGE_DRIVER=s3): uploads to Scaleway Object Storage
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<StorageResult> {
  if (process.env.STORAGE_DRIVER === "s3") {
    const { uploadToS3 } = await import("./s3");
    return uploadToS3(buffer, filename, contentType);
  }
  const { uploadToLocal } = await import("./local");
  return uploadToLocal(buffer, filename);
}

/**
 * Get the public URL for a stored file.
 * - Local: `/api/uploads/{filename}`
 * - S3: direct Scaleway Object Storage URL
 */
export function getPublicUrl(filename: string): string {
  if (process.env.STORAGE_DRIVER === "s3") {
    const bucket = process.env.S3_BUCKET_NAME;
    const region = process.env.S3_BUCKET_REGION;
    return `https://${bucket}.s3.${region}.scw.cloud/${filename}`;
  }
  return `/api/uploads/${filename}`;
}
