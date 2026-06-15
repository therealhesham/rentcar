import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { uploadBufferToSpaces } from "../lib/spaces-upload";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const CARS_DIR = path.join(__dirname, "../../cars"); // __dirname is scripts/, so ../cars/ is root/cars/
// wait, d:\rentcar\scripts\.. is d:\rentcar, so ../cars is d:\rentcar\cars

const fileToModelId: Record<string, number> = {
  "2024-Hyundai-Accent .jpg": 100,
  "Chery-Tiggo 2023.png": 110,
  "Hyundai  grand I10 2025.png": 112,
  "Hyundai Accent_2025.png": 101,
  "hyundai accent 2023.jpeg": 99,
  "hyundai elantra 2023.webp": 103,
  "hyundai elantra 2024.png": 104,
  "hyundai grand 10 2024.png": 111,
  "hyundai sonata 2023.png": 117,
  "hyundai sonata 2024.jpg": 118,
  "hyundai sonata2025.png": 119,
  "hyundai staria 2024.png": 115,
  "hyundai venu 2025.png": 123,
  "hyundai venue 2024.png": 122,
  "kia carens 2024.png": 124,
  "kia pegas 2022.png": 106,
  "kia pegas 2024.png": 108,
  "kia pegas 2025.png": 109,
  "kia pegass 2023.png": 107,
  "lexus es250   2023.png": 94,
  "nissan sunny 2020.png": 120,
  "suzuki 2024.png": 113,
  "toyota camery 2020.jpg": 126,
  "toyota camery 2023.jpeg": 125,
  "toyota corolla 2021.jpg": 128,
  "toyota corolla 2023.png": 127,
  "toyota raiz 2023.png": 114,
  "toyota veloz 2023.jpg": 121,
  "toyota yaris 2021.webp": 133,
  "toyota yaris 2023.png": 134,
  "toyota yaris 2024.png": 135
};

async function main() {
  let ok = 0;
  let fail = 0;

  for (const [fileName, modelId] of Object.entries(fileToModelId)) {
    console.log(`Processing ${fileName} for model ID ${modelId}...`);
    try {
      const filePath = path.join(__dirname, "../cars", fileName);
      if (!fs.existsSync(filePath)) {
        console.error(`  [!] File not found: ${filePath}`);
        fail++;
        continue;
      }

      const buffer = fs.readFileSync(filePath);
      let ext = path.extname(fileName).toLowerCase().replace(".", "");
      if (ext === "jpeg") ext = "jpg";
      const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

      const url = await uploadBufferToSpaces(buffer, {
        folderSlug: "vehicles",
        mime,
        fileBaseName: `car-${modelId}-${Date.now()}`
      });

      await prisma.carModel.update({
        where: { id: modelId },
        data: { image: url }
      });

      console.log(`  [✓] Uploaded and updated. URL: ${url}`);
      ok++;
    } catch (err: any) {
      console.error(`  [X] Failed: ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone. Success: ${ok}, Failed: ${fail}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
