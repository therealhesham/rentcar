import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  SUBSCRIPTION_ALLOWED_MIMES,
  SUBSCRIPTION_UPLOAD_MAX_BYTES,
  subscriptionUploadRootAbs,
} from "@/lib/subscriptions/constants";

function safeLeaf(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

/**
 * يحفظ الملف تحت مجلد الاشتراك ويعيد مسارًا نسبيًا لتخزينه في قاعدة البيانات.
 */
export async function saveSubscriptionUpload(opts: {
  subscriptionId: number;
  buf: Buffer;
  originalName: string;
  mimeType: string;
}): Promise<{ relativePath: string }> {
  const { subscriptionId, buf, originalName, mimeType } = opts;
  if (buf.byteLength <= 0) {
    throw new Error("EMPTY_FILE");
  }
  if (buf.byteLength > SUBSCRIPTION_UPLOAD_MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  if (!SUBSCRIPTION_ALLOWED_MIMES.has(mimeType)) {
    throw new Error("MIME_NOT_ALLOWED");
  }

  const root = subscriptionUploadRootAbs();
  const dir = path.join(root, String(subscriptionId));
  await fs.mkdir(dir, { recursive: true });

  const token = randomBytes(12).toString("hex");
  const leaf = `${token}_${safeLeaf(originalName)}`;
  const absPath = path.join(dir, leaf);
  await fs.writeFile(absPath, buf);

  return { relativePath: path.relative(root, absPath).split(path.sep).join("/") };
}

export async function readSubscriptionRelativeFile(absFromDb: string): Promise<Buffer> {
  const root = subscriptionUploadRootAbs();
  const abs = path.join(root, ...absFromDb.split("/"));
  if (!abs.startsWith(root)) throw new Error("PATH_TRAVERSAL");
  return fs.readFile(abs);
}
