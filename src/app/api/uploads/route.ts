import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentMembership } from "@/lib/auth/membership";
import { uploadFile } from "@/lib/storage";

import type { NextRequest } from "next/server";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

export async function POST(request: NextRequest) {
  // Auth — admin only
  const ctx = await getCurrentMembership();
  if (!ctx || ctx.account.type !== "admin") {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Admin access required" } },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "No file provided" } },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_FILE_TYPE",
          message: "Only JPEG, PNG, WebP, AVIF and GIF are allowed",
        },
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: { code: "FILE_TOO_LARGE", message: "File must be under 5 MB" } },
      { status: 400 }
    );
  }

  // Generate unique filename
  const randomId = crypto.randomBytes(16).toString("hex");
  const extension = EXTENSION_MAP[file.type] ?? ".bin";
  const filename = `${randomId}${extension}`;

  // Upload to configured storage backend (local filesystem or S3)
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadFile(buffer, filename, file.type);

  return NextResponse.json({ data: result }, { status: 201 });
}
