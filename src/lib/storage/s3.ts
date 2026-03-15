import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { StorageResult } from "./index";

function getS3Client(): S3Client {
  const region = process.env.S3_BUCKET_REGION;
  if (!region) throw new Error("S3_BUCKET_REGION is not configured");

  return new S3Client({
    region,
    endpoint: `https://s3.${region}.scw.cloud`,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
    // Scaleway requires path-style access
    forcePathStyle: true,
  });
}

export async function uploadToS3(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<StorageResult> {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) throw new Error("S3_BUCKET_NAME is not configured");

  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      ACL: "public-read",
    })
  );

  const region = process.env.S3_BUCKET_REGION;
  const url = `https://${bucket}.s3.${region}.scw.cloud/${filename}`;

  return { url, filename };
}
