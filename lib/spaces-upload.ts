import {
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";

/** @deprecated استخدم بادئة مجلد محدد عبر folderPrefix */
export const GALLERY_S3_PREFIX = "rentcar/gallery/";

function folderPrefix(slug: string): string {
  return `rentcar/${slug}/`;
}

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
      process.env.SPACES_BUCKET,
  );
}

/**
 * رابط HTTPS عام للملف داخل Spaces — يطابق صيغة DO الافتراضية (subdomain) أو path-style عند ضبط SPACES_PUBLIC_URL على الـ endpoint الإقليمي فقط.
 */
export function publicUrlForSpacesObjectKey(key: string): string {
  const region = process.env.SPACES_REGION!;
  const bucket = process.env.SPACES_BUCKET!;
  const virtualHostedOrigin = `https://${bucket}.${region}.digitaloceanspaces.com`;
  const explicit = process.env.SPACES_PUBLIC_URL?.trim();

  if (!explicit) {
    return `${virtualHostedOrigin}/${key}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(explicit.replace(/\/$/, ""));
  } catch {
    return `${virtualHostedOrigin}/${key}`;
  }

  const host = parsed.hostname;
  // ضُبط SPACES_PUBLIC_URL على https://<region>.digitaloceanspaces.com فقط — الوصول العام path-style
  if (host === `${region}.digitaloceanspaces.com`) {
    return `${parsed.origin}/${bucket}/${key}`;
  }

  // bucket.region.digitaloceanspaces.com أو نطاق CDN مخصّص
  return `${parsed.origin}/${key}`;
}

function trustedSpacesOrigins(): Set<string> {
  const region = process.env.SPACES_REGION!;
  const bucket = process.env.SPACES_BUCKET!;
  const origins = new Set<string>();
  origins.add(`https://${bucket}.${region}.digitaloceanspaces.com`);
  origins.add(`https://${region}.digitaloceanspaces.com`);
  const explicit = process.env.SPACES_PUBLIC_URL?.trim();
  if (explicit) {
    try {
      origins.add(new URL(explicit.replace(/\/$/, "")).origin);
    } catch {
      /* ignore */
    }
  }
  return origins;
}

function objectKeyFromPublicUrlPathname(pathname: string): string {
  const p = pathname.replace(/^\/+/, "");
  const bucket = process.env.SPACES_BUCKET!;
  if (p.startsWith(`${bucket}/`)) {
    return p.slice(bucket.length + 1);
  }
  return p;
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
/**
 * يتحقق أن الرابط يخص نفس الـ bucket العام (مسار rentcar/...) لاستخدامه من نماذج الإدارة.
 */
export function isTrustedSpacesImageUrl(url: string): boolean {
  if (!isSpacesConfigured()) return false;
  try {
    const u = new URL(url.trim());
    if (!trustedSpacesOrigins().has(u.origin)) return false;
    const key = objectKeyFromPublicUrlPathname(u.pathname);
    return key.startsWith("rentcar/");
  } catch {
    return false;
  }
}

export type GalleryListItem = {
  key: string;
  url: string;
  lastModified: Date | undefined;
};

const GALLERY_PAGE_SIZE = 10;

/**
 * يعرض صور مجلد واحد تحت `rentcar/<folder>/` مع ترقيم صفحات (افتراضي 10 لكل طلب).
 */
export async function listImagesInFolder(
  folderSlug: string,
  continuationToken?: string,
  maxKeys: number = GALLERY_PAGE_SIZE,
): Promise<{ items: GalleryListItem[]; nextCursor?: string }> {
  if (!isSpacesConfigured()) {
    throw new Error("لم يُضبط تخزين Spaces.");
  }
  const bucket = process.env.SPACES_BUCKET!;
  const client = getS3Client();
  const prefix = folderPrefix(folderSlug);
  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: Math.min(Math.max(1, maxKeys), 100),
      ContinuationToken: continuationToken || undefined,
    }),
  );

  const items = (res.Contents ?? [])
    .filter((c) => c.Key && !c.Key.endsWith("/"))
    .map((c) => ({
      key: c.Key!,
      url: publicUrlForSpacesObjectKey(c.Key!),
      lastModified: c.LastModified,
    }))
    .sort(
      (a, b) =>
        (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0),
    );

  return {
    items,
    nextCursor: res.IsTruncated ? res.NextContinuationToken : undefined,
  };
}

export async function uploadImageToSpaces(
  file: File,
  folderSlug: string,
): Promise<string> {
  if (!isSpacesConfigured()) {
    throw new Error(
      "لم يُضبط تخزين Spaces: SPACES_REGION، SPACES_ACCESS_KEY_ID، SPACES_SECRET_ACCESS_KEY، SPACES_BUCKET",
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

  const key = `${folderPrefix(folderSlug)}${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const bucket = process.env.SPACES_BUCKET!;
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mime,
      ACL: "public-read",
    }),
  );

  return publicUrlForSpacesObjectKey(key);
}
