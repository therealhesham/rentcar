import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const CARS_DIR = path.join(__dirname, "../cars");

function normalizeStr(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
    const files = fs.readdirSync(CARS_DIR).filter(f => f.match(/\.(png|jpg|jpeg|webp|gif)$/i));
    
    const models = await prisma.carModel.findMany({
        include: { brand: true },
    });

    console.log(`Found ${files.length} images and ${models.length} car models in DB.`);

    let matchedCount = 0;

    for (const file of files) {
        const fileNameNorm = normalizeStr(file);
        
        let bestMatch = null;
        let bestScore = 0;

        for (const model of models) {
            const brandNorm = normalizeStr(model.brand.name);
            const modelNorm = normalizeStr(model.name);
            // Some models might have spaces or dashes, let's also check parts
            
            const yearNorm = model.year.toString();
            
            let score = 0;
            if (fileNameNorm.includes(brandNorm)) score += 2;
            if (fileNameNorm.includes(modelNorm)) score += 4; // model name is most important
            if (fileNameNorm.includes(yearNorm)) score += 1;
            
            // fuzzy match e.g. "camery" vs "camry", "attrag" vs "attrage"
            // If they don't exactly include, check if it's very close. For now exact include is fine since we normalized.
            // Let's add specific hardcoded mappings if needed later.
            if (file.toLowerCase().includes("camery") && modelNorm.includes("camry")) score += 4;
            if (file.toLowerCase().includes("attrag") && modelNorm.includes("attrage")) score += 4;
            if (file.toLowerCase().includes("pegass") && modelNorm.includes("pegas")) score += 4;

            if (score > bestScore && score >= 4) {
                bestScore = score;
                bestMatch = model;
            }
        }
        
        if (bestMatch) {
            console.log(`[MATCH] ${file.padEnd(30)}  ==>  ${bestMatch.brand.name} ${bestMatch.name} ${bestMatch.year}`);
            matchedCount++;
        } else {
            console.log(`[UNMATCHED] ${file}`);
        }
    }
    console.log(`Total matched: ${matchedCount} / ${files.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
