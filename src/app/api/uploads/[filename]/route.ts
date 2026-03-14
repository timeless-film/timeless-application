import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getPublicUrl } from "@/lib/storage";

import type { NextRequest } from "next/server";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

// Only allow safe characters in filenames (hex + extension)
const SAFE_FILENAME = /^[a-f0-9]+\.(jpg|jpeg|png|webp|avif|gif)$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Validate filename to prevent path traversal
  if (!SAFE_FILENAME.test(filename)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "File not found" } },
      { status: 404 }
    );
  }

  // In S3 mode, redirect to the direct Object Storage URL
  if (process.env.STORAGE_DRIVER === "s3") {
    return NextResponse.redirect(getPublicUrl(filename), 301);
  }

  // Local mode: serve from filesystem
  const filePath = path.join(UPLOADS_DIR, filename);

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "File not found" } },
      { status: 404 }
    );
  }
}
