/**
 * تحديث صور الموديلات من مجلد محلي — اسم الملف هو "الماركة الموديل السنة".
 *
 * تشغيل:
 *   npx tsx prisma/scripts/update-vehicle-images-from-folder.ts --dir "/path/to/folder" --dry-run
 *   npx tsx prisma/scripts/update-vehicle-images-from-folder.ts --dir "/path/to/folder"
 *
 * يُرفع الملف باسم يتضمن بصمة محتواه (hash) حتى يتغيّر الرابط عند تغيّر الصورة،
 * فلا تظهر النسخة القديمة من كاش المتصفح/الـ CDN.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { isSpacesConfigured, uploadBufferToSpaces } from "../../lib/spaces-upload";

const prisma = new PrismaClient();

const VEHICLES_FOLDER = "vehicles";

const MIME_BY_EXT: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/** أسماء في الملفات لا تطابق ما في القاعدة حرفياً — تُترجم قبل المطابقة. */
const TEXT_ALIASES: Record<string, string> = {
  "great wall wingle 7": "Wingle 7 Wingle Pickup",
};

/** توحيد النص: حروف وأرقام فقط بدون مسافات، لمقارنة صارمة. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** slug صالح كاسم ملف في Spaces. */
function slug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function parseArgs(argv: string[]) {
  const dirIdx = argv.indexOf("--dir");
  const dir = dirIdx >= 0 ? argv[dirIdx + 1] : undefined;
  return { dir, dryRun: argv.includes("--dry-run") };
}

async function main() {
  const { dir, dryRun } = parseArgs(process.argv.slice(2));

  if (!dir) throw new Error("مرّر مسار المجلد عبر --dir");
  if (!fs.existsSync(dir)) throw new Error(`المجلد غير موجود: ${dir}`);
  if (!dryRun && !isSpacesConfigured()) {
    throw new Error(
      "Spaces غير مضبوط: SPACES_REGION، SPACES_ACCESS_KEY_ID، SPACES_SECRET_ACCESS_KEY، SPACES_BUCKET",
    );
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => MIME_BY_EXT[path.extname(f).toLowerCase()])
    .sort();

  const models = await prisma.carModel.findMany({ include: { brand: true } });

  console.log("—— تحديث صور المركبات من مجلد ——");
  console.log(`المجلد: ${dir}`);
  console.log(`عدد الصور: ${files.length} · موديلات القاعدة: ${models.length}`);
  if (dryRun) console.log("وضع تجريبي — لن يُرفع أو يُحدَّث شيء");
  console.log("");

  let ok = 0;
  let unmatched = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i]!;
    const ext = path.extname(fileName).toLowerCase();
    const base = path.basename(fileName, ext);

    process.stdout.write(`[${i + 1}/${files.length}] ${fileName} … `);

    const yearMatch = base.match(/\b(19|20)\d{2}\b/);
    if (!yearMatch) {
      console.log("⚠️ لا توجد سنة في الاسم — تخطي");
      unmatched++;
      continue;
    }
    const year = parseInt(yearMatch[0], 10);
    const rawText = base.replace(yearMatch[0], " ").replace(/\s+/g, " ").trim();
    const text = TEXT_ALIASES[rawText.toLowerCase()] ?? rawText;
    const wanted = norm(text);

    const matches = models.filter((m) => {
      if (m.year !== year) return false;
      const candidates = [
        norm(`${m.brand.nameEn ?? ""}${m.nameEn ?? ""}`),
        norm(`${m.brand.name}${m.name}`),
        norm(`${m.brand.nameEn ?? ""}${m.name}`),
        norm(`${m.brand.name}${m.nameEn ?? ""}`),
      ].filter(Boolean);
      return candidates.includes(wanted);
    });

    if (matches.length === 0) {
      console.log(`⚠️ لا يوجد موديل مطابق لـ "${text} ${year}" — تخطي`);
      unmatched++;
      continue;
    }
    if (matches.length > 1) {
      console.log(
        `⚠️ تطابق متعدد (${matches.map((m) => `#${m.id}`).join(", ")}) — تخطي`,
      );
      unmatched++;
      continue;
    }

    const m = matches[0]!;
    const label = `${m.brand.name} ${m.name} ${m.year} (#${m.id})`;

    try {
      const buffer = fs.readFileSync(path.join(dir, fileName));
      const hash = createHash("sha1").update(buffer).digest("hex").slice(0, 8);
      const fileBaseName = `${slug(base)}-${hash}`;

      if (dryRun) {
        console.log(
          `→ ${label} · ${fileBaseName}${ext} (${(buffer.length / 1024).toFixed(0)} KB)`,
        );
        ok++;
        continue;
      }

      const publicUrl = await uploadBufferToSpaces(buffer, {
        folderSlug: VEHICLES_FOLDER,
        mime: MIME_BY_EXT[ext]!,
        fileBaseName,
      });

      await prisma.carModel.update({
        where: { id: m.id },
        data: {
          image: publicUrl,
          alt: m.alt?.trim() || `${m.brand.name} ${m.name} ${m.year}`,
        },
      });

      console.log(`✓ ${label}\n    ${publicUrl}`);
      ok++;
    } catch (e) {
      console.log(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }
  }

  console.log("\n—— ملخص ——");
  console.log(`تم: ${ok} · بلا مطابقة: ${unmatched} · فشل: ${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
