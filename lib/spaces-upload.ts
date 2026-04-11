import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";

const MAX_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isSpacesConfigured(): boolean {
  return Boolean(
    process.env.SPACES_REGION &&
      process.env.SPACES_ACCESS_KEY_ID &&
      process.env.SPACES_SECRET_ACCESS_KEY &&
      process.env.SPACES_BUCKET &&
      process.env.SPACES_PUBLIC_URL,
  );
}

function getS3Client(): S3Client {
  const region = process.env.SPACES_REGION;
  if (!region) {
    throw new Error("SPACES_REGION missing");
  }
  return new S3Client({
    region,
    endpoint: `https://${region}.digitaloceanspaces.com`,
    credentials: {
      accessKeyId: process.env.SPACES_ACCESS_KEY_ID!,
      secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: false,
  });
}

function extensionForFile(file: File): string | null {
  const mime = file.type?.toLowerCase() ?? "";
  if (mime && MIME_TO_EXT[mime]) {
    return MIME_TO_EXT[mime];
  }
  const name = file.name?.toLowerCase() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot >= 0) {
    const ext = name.slice(dot + 1);
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  }
  return null;
}

/**
 * رفع صورة إلى DigitalOcean Spaces (S3-compatible) وإرجاع الرابط العام المخزَّن في قاعدة البيانات.
 */
export async function uploadImageToSpaces(
  file: File,
  folder: "categories" | "cars",
): Promise<string> {
  if (!isSpacesConfigured()) {
    throw new Error(
      "لم يُضبط تخزين Spaces: SPACES_REGION، SPACES_ACCESS_KEY_ID، SPACES_SECRET_ACCESS_KEY، SPACES_BUCKET، SPACES_PUBLIC_URL",
    );
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("ملف الصورة غير صالح.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("حجم الصورة يتجاوز 5 ميجابايت.");
  }

  const ext = extensionForFile(file);
  if (!ext) {
    throw new Error("نوع الصورة غير مدعوم (JPEG، PNG، WebP، GIF).");
  }

  const mimeFromType = file.type?.toLowerCase() ?? "";
  const mime =
    mimeFromType && MIME_TO_EXT[mimeFromType]
      ? mimeFromType
      : ext === "jpg"
        ? "image/jpeg"
        : `image/${ext}`;

  const key = `rentcar/${folder}/${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const bucket = process.env.SPACES_BUCKET!;
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mime,
    }),
  );

  const base = process.env.SPACES_PUBLIC_URL!.replace(/\/$/, "");
  return `${base}/${key}`;
}
