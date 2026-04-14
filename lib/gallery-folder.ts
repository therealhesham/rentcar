import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function generateInternalFolderSlug(): string {
  return `m-${randomBytes(12).toString("hex")}`;
}

/** يطابق مسار المجلد في Spaces تحت `rentcar/<slug>/` */
export function normalizeGalleryFolderSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function isValidGalleryFolderSlug(slug: string): boolean {
  return Boolean(slug.length >= 1 && slug.length <= 64 && SLUG_RE.test(slug));
}

export async function listGalleryFoldersForApi() {
  return prisma.galleryFolder.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { slug: true, label: true },
  });
}

export async function galleryFolderExists(slug: string): Promise<boolean> {
  const row = await prisma.galleryFolder.findUnique({
    where: { slug },
    select: { id: true },
  });
  return Boolean(row);
}

export async function requireGalleryFolderSlug(slug: string): Promise<void> {
  if (!(await galleryFolderExists(slug))) {
    throw new Error(
      `مجلد المعرض «${slug}» غير معرّف في جدول GalleryFolder. أضفه من معرض الصور أو نفّذ seed.`,
    );
  }
}

export async function createGalleryFolder(input: {
  label: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const label = input.label.trim();
  if (!label) {
    return { ok: false, error: "أدخل اسماً للمجلد." };
  }

  const agg = await prisma.galleryFolder.aggregate({ _max: { sortOrder: true } });
  const nextOrder = (agg._max.sortOrder ?? -1) + 1;

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = generateInternalFolderSlug();
    if (!isValidGalleryFolderSlug(slug)) {
      continue;
    }
    try {
      await prisma.galleryFolder.create({
        data: {
          label,
          slug,
          sortOrder: nextOrder,
        },
      });
      return { ok: true };
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e
          ? String((e as { code: string }).code)
          : "";
      if (code === "P2002") {
        continue;
      }
      console.error(e);
      return { ok: false, error: "تعذّر إنشاء المجلد." };
    }
  }
  return { ok: false, error: "تعذّر إنشاء المجلد. حاول مرة أخرى." };
}
