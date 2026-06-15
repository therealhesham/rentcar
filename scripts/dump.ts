import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const models = await prisma.carModel.findMany({ include: { brand: true } });
  console.log(JSON.stringify(models.map(x => ({ id: x.id, b: x.brand.name, n: x.name, e: x.nameEn, y: x.year })), null, 2));
}

main().catch(console.error).finally(()=>prisma.$disconnect());
