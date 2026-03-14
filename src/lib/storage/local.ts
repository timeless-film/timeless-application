import fs from "node:fs/promises";
import path from "node:path";

import type { StorageResult } from "./index";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function uploadToLocal(buffer: Buffer, filename: string): Promise<StorageResult> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);
  return { url: `/api/uploads/${filename}`, filename };
}
