import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

const categories = [
  {
    slug: "sedan",
    title: "سيدان",
    description:
      "تنوّع في السيارات المناسبة للتنقل داخل المدينة أو الرحلات القصيرة بين المدن مع العائلة، مع مساحة تخزين جيدة واقتصاد في استهلاك الوقود يناسب العائلات الصغيرة.",
    image:
      "https://images.unsplash.com/photo-1617531653332-bd46c24f0668?auto=format&fit=crop&w=900&q=80",
    alt: "سيارة سيدان بيضاء أنيقة",
    sortOrder: 0,
  },
  {
    slug: "compact",
    title: "السيارات الصغيرة",
    description:
      "خيار مثالي للتنقل اليومي والعمل بأسعار مناسبة للميزانية، مع أداء اقتصادي للرحلات القصيرة والقيادة داخل المدينة وسهولة في الوقوف.",
    image:
      "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=900&q=80",
    alt: "سيارة صغيرة بيضاء للمدينة",
    sortOrder: 1,
  },
  {
    slug: "luxury",
    title: "فخمة",
    description:
      "راحة تامة وتجربة تنقل لا تُضاهى مع ماركات فاخرة، لمناسباتك الخاصة ولحضور مميز يعكس أناقتك على الطريق.",
    image:
      "https://images.unsplash.com/photo-1563720223185-11003d516931?auto=format&fit=crop&w=900&q=80",
    alt: "سيارة فاخرة بيضاء",
    sortOrder: 2,
  },
  {
    slug: "suv-4x4",
    title: "دفع رباعي",
    description:
      "مساحة واسعة وتخزين للرحلات الطويلة، ومقاعد تتسع حتى لخمسة ركاب، مع أنظمة أمان وترفيه لرحلة عائلية مريحة.",
    image:
      "https://images.unsplash.com/photo-1559416523-8dd2b4f2d0d0?auto=format&fit=crop&w=900&q=80",
    alt: "مركبة دفع رباعي بيضاء",
    sortOrder: 3,
  },
  {
    slug: "family",
    title: "عائلية",
    description:
      "خطّط لرحلتك مع العائلة وأمتعتهم في مكان واحد: قصص، ووجبات، وذكريات تُروى في رحلة واحدة بأمان وراحة.",
    image:
      "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=900&q=80",
    alt: "سيارة عائلية رياضية متعددة الاستخدام",
    sortOrder: 4,
  },
];

const brandNames = [
  "Porsche",
  "Mercedes-Benz",
  "BMW",
  "Toyota",
  "Hyundai",
  "Lexus",
  "Audi",
  "Land Rover",
];

async function main() {
  for (const c of categories) {
    await prisma.fleetCategory.upsert({
      where: { slug: c.slug },
      create: c,
      update: {
        title: c.title,
        description: c.description,
        image: c.image,
        alt: c.alt,
        sortOrder: c.sortOrder,
      },
    });
  }

  for (const name of brandNames) {
    await prisma.brand.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }

  const galleryFolders = [
    { slug: "vehicles", label: "المركبات", sortOrder: 0 },
    { slug: "categories", label: "الفئات", sortOrder: 1 },
    { slug: "gallery", label: "عام", sortOrder: 2 },
    { slug: "home", label: "الصفحة الرئيسية (هيرو)", sortOrder: 3 },
    { slug: "branches", label: "الفروع", sortOrder: 4 },
  ];
  for (const g of galleryFolders) {
    await prisma.galleryFolder.upsert({
      where: { slug: g.slug },
      create: g,
      update: { label: g.label, sortOrder: g.sortOrder },
    });
  }

  const seedUserEmail = "hesham@gmail.com";
  const seedUserPassword = "password";
  const heshamHash = await hashPassword(seedUserPassword);
  await prisma.user.upsert({
    where: { email: seedUserEmail },
    create: {
      email: seedUserEmail,
      passwordHash: heshamHash,
      name: "Hesham",
      phone: null,
      isAdmin: false,
    },
    update: {
      passwordHash: heshamHash,
      name: "Hesham",
    },
  });
  console.log(`User seeded: ${seedUserEmail} (password: ${seedUserPassword})`);

  /**
   * خطط اشتراك شهرية تجريبية مشروطة بوجود موديل في الجدول Fleet.
   */
  const carModel = await prisma.carModel.findFirst({
    orderBy: { id: "asc" },
    include: { brand: true },
  });
  if (carModel) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: "seed-flex-sedan-plus" },
      create: {
        slug: "seed-flex-sedan-plus",
        carModelId: carModel.id,
        marketingTitleAr: `اشتراك شهرى — ${carModel.brand.name} ${carModel.name}`,
        descriptionAr:
          "باقة لتجربة واجهة الاشتراك الشهري، ببدلات حقيقية ومتصلة بسيارة مسجّلة فعلياً في الأسطول.",
        monthlyPriceSar: 2800,
        mileageKmPerMonth: 3500,
        insuranceIncluded: true,
        maintenanceIncluded: true,
        depositAmountSar: 4000,
        extraKmFeeSarPerKm: 5,
        durationOptionsCsv: "1,3,6",
        isActive: true,
        sortOrder: 0,
      },
      update: {
        monthlyPriceSar: 2800,
        mileageKmPerMonth: 3500,
        marketingTitleAr: `اشتراك شهرى — ${carModel.brand.name} ${carModel.name}`,
      },
    });

    await prisma.subscriptionPlan.upsert({
      where: { slug: "seed-urban-compact" },
      create: {
        slug: "seed-urban-compact",
        carModelId: carModel.id,
        marketingTitleAr: `اشتراك حضري — ${carModel.brand.name} ${carModel.name}`,
        descriptionAr: "صف ثانٍ لعرض المقارنة داخل نفس صفحة الأسطول الاشتراكي.",
        monthlyPriceSar: 1800,
        mileageKmPerMonth: 2500,
        insuranceIncluded: true,
        maintenanceIncluded: false,
        depositAmountSar: 2200,
        extraKmFeeSarPerKm: 4,
        durationOptionsCsv: "1,3,6",
        isActive: true,
        sortOrder: 10,
      },
      update: {
        monthlyPriceSar: 1800,
      },
    });
    console.log(`Subscription plans seeded for CarModel #${carModel.id}`);
  } else {
    console.warn(
      "لم يُعرَف موديل سيارة — أكمل إدخال مركبة في لوحة التحكم لتوليد بيانات seed للاشتراك.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
