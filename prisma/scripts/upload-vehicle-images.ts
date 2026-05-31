/**
 * رفع صور الموديلات إلى DigitalOcean Spaces حسب الماركة + الموديل + السنة.
 *
 * تشغيل:
 *   npx tsx prisma/scripts/upload-vehicle-images.ts
 *   npx tsx prisma/scripts/upload-vehicle-images.ts --dry-run
 *   npx tsx prisma/scripts/upload-vehicle-images.ts --force
 *   npx tsx prisma/scripts/upload-vehicle-images.ts --limit 5
 *   npx tsx prisma/scripts/upload-vehicle-images.ts --id 42
 *
 * اختياري في .env (أي مفتاح يحسّن النتائج):
 *   PEXELS_API_KEY — https://www.pexels.com/api/
 *   PIXABAY_API_KEY — https://pixabay.com/api/docs/
 * بدون مفاتيح: Wikimedia Commons فقط (قد يتطلب وصولاً للإنترنت من السيرفر).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  fetchVehicleImageFromWeb,
  vehicleImageFileBaseName,
} from "../../lib/vehicle-image-fetch";
import { isSpacesConfigured, uploadBufferToSpaces } from "../../lib/spaces-upload";

const prisma = new PrismaClient();

const VEHICLES_FOLDER = "vehicles";

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const force = argv.includes("--force");
  const limitIdx = argv.indexOf("--limit");
  const limit =
    limitIdx >= 0 ? Math.max(1, parseInt(argv[limitIdx + 1] ?? "", 10) || 0) : undefined;
  const idIdx = argv.indexOf("--id");
  const id =
    idIdx >= 0 ? parseInt(argv[idIdx + 1] ?? "", 10) : undefined;
  return { dryRun, force, limit, id: Number.isFinite(id) ? id : undefined };
}

async function main() {
  const { dryRun, force, limit, id } = parseArgs(process.argv.slice(2));

  if (!dryRun && !isSpacesConfigured()) {
    throw new Error(
      "Spaces غير مضبوط. أضف SPACES_REGION و SPACES_ACCESS_KEY_ID و SPACES_SECRET_ACCESS_KEY و SPACES_BUCKET في .env",
    );
  }

  const models = await prisma.carModel.findMany({
    where: id ? { id } : undefined,
    include: { brand: true },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }, { year: "desc" }],
    ...(limit && !id ? { take: limit } : {}),
  });

  const targets = force
    ? models
    : models.filter((m) => !m.image?.trim());

  console.log("—— رفع صور المركبات ——");
  console.log(`إجمالي الموديلات: ${models.length}`);
  console.log(`مستهدف: ${targets.length}${force ? " (force)" : " (بدون صورة فقط)"}`);
  if (dryRun) console.log("وضع تجريبي — لن يُرفع أو يُحدَّث شيء\n");

  let ok = 0;
  let fail = 0;
  let skip = 0;

  for (let i = 0; i < targets.length; i++) {
    const m = targets[i]!;
    const label = `${m.brand.name} ${m.name} ${m.year} (#${m.id})`;
    process.stdout.write(`[${i + 1}/${targets.length}] ${label} … `);

    if (!force && m.image?.trim()) {
      console.log("تخطي (لها صورة)");
      skip++;
      continue;
    }

    try {
      const fetched = await fetchVehicleImageFromWeb(
        m.brand.name,
        m.name,
        m.year,
      );

      if (!fetched) {
        console.log("لم تُعثر على صورة");
        fail++;
        continue;
      }

      const alt = `${m.brand.name} ${m.name} ${m.year}`.trim();

      if (dryRun) {
        console.log(
          `OK [${fetched.provider}] ${(fetched.buffer.length / 1024).toFixed(0)} KB — ${fetched.sourceUrl.slice(0, 72)}…`,
        );
        ok++;
        continue;
      }

      const publicUrl = await uploadBufferToSpaces(fetched.buffer, {
        folderSlug: VEHICLES_FOLDER,
        mime: fetched.mime,
        fileBaseName: vehicleImageFileBaseName(m.brand.name, m.name, m.year),
      });

      await prisma.carModel.update({
        where: { id: m.id },
        data: {
          image: publicUrl,
          alt: m.alt?.trim() || alt,
        },
      });

      console.log(`✓ [${fetched.provider}] ${publicUrl}`);
      ok++;

      await new Promise((r) => setTimeout(r, 600));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`خطأ: ${msg}`);
      fail++;
    }
  }

  console.log("\n—— ملخص ——");
  console.log(`نجح: ${ok} · فشل/لا صورة: ${fail} · تخطي: ${skip}`);
  if (
    !process.env.PEXELS_API_KEY?.trim() &&
    !process.env.PIXABAY_API_KEY?.trim()
  ) {
    console.log(
      "تلميح: أضف PEXELS_API_KEY أو PIXABAY_API_KEY في .env لنتائج أوضح",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
