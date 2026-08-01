import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { uploadBufferToSpaces, isSpacesConfigured } from "../../lib/spaces-upload";

const prisma = new PrismaClient();
const NEW_CARS_DIR = "./سيارات الموقع الجديد";

function walk(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      if (file.toLowerCase().endsWith(".webp") || file.toLowerCase().endsWith(".png") || file.toLowerCase().endsWith(".jpg")) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

function cleanBaseName(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  if (!isSpacesConfigured()) {
    throw new Error(
      "DigitalOcean Spaces is not configured. Please check SPACES_REGION, SPACES_ACCESS_KEY_ID, SPACES_SECRET_ACCESS_KEY, SPACES_BUCKET in .env"
    );
  }

  const files = walk(NEW_CARS_DIR);
  console.log(`\n==================================================`);
  console.log(`🚗 Found ${files.length} car images in '${NEW_CARS_DIR}'`);
  console.log(`==================================================\n`);

  const models = await prisma.carModel.findMany({
    include: { brand: true, category: true },
  });

  let uploadedCount = 0;
  let updatedDbCount = 0;
  const results: Array<{ file: string; url: string; modelId?: number; modelName?: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]!;
    const fileName = path.basename(filePath);
    const fileBase = cleanBaseName(fileName);

    process.stdout.write(`[${i + 1}/${files.length}] Uploading ${fileName} ... `);

    const buffer = fs.readFileSync(filePath);
    const mime = filePath.endsWith(".png") ? "image/png" : filePath.endsWith(".jpg") || filePath.endsWith(".jpeg") ? "image/jpeg" : "image/webp";

    const publicUrl = await uploadBufferToSpaces(buffer, {
      folderSlug: "vehicles",
      mime,
      fileBaseName: fileBase,
    });

    uploadedCount++;
    console.log(`✓ Uploaded`);

    // Match with DB model
    const yearMatch = fileName.match(/\b(20\d\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
    const textNoYear = fileName.replace(/\b20\d\d\b/, "").replace(/\.webp$/i, "").trim();

    let matchedModel = models.find((m) => {
      if (year && m.year !== year) return false;

      const brandStr = (m.brand.name + " " + (m.brand.nameEn || "")).toLowerCase();
      const modelStr = (m.name + " " + (m.nameEn || "")).toLowerCase();
      const textLower = textNoYear.toLowerCase();

      // Check Wingle / Great Wall special case
      if (textLower.includes("wingle") && (m.brand.name.includes("وينجل") || m.name.includes("بيك اب"))) {
        return true;
      }

      // General matching
      const matchesBrand = brandStr.includes(textLower.split(" ")[0]) || textLower.includes(m.brand.name.toLowerCase());
      const matchesModel = textLower.includes(m.name.toLowerCase()) || (m.nameEn && textLower.includes(m.nameEn.toLowerCase()));

      return matchesBrand && matchesModel;
    });

    if (matchedModel) {
      const altText = `${matchedModel.brand.name} ${matchedModel.name} ${matchedModel.year}`.trim();
      await prisma.carModel.update({
        where: { id: matchedModel.id },
        data: {
          image: publicUrl,
          alt: altText,
        },
      });
      updatedDbCount++;
      console.log(`   └─ 🔗 Linked to DB model #${matchedModel.id}: ${altText}`);
      results.push({ file: fileName, url: publicUrl, modelId: matchedModel.id, modelName: altText });
    } else {
      console.log(`   └─ ⚠️ Uploaded to Spaces but no matching DB model year/name found for '${fileName}'`);
      results.push({ file: fileName, url: publicUrl });
    }
  }

  console.log(`\n==================================================`);
  console.log(`🎉 COMPLETED!`);
  console.log(`Total Images Uploaded to DigitalOcean Spaces: ${uploadedCount}`);
  console.log(`Total Database Models Updated: ${updatedDbCount}`);
  console.log(`==================================================\n`);
}

main()
  .catch((err) => {
    console.error("❌ Error running script:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
