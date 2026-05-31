import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.branch.findMany({
    select: { id: true, name: true, slug: true, openingHoursJson: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
