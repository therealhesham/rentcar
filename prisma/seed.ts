import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { saudiLocalNineToE164 } from "../lib/normalize-saudi-phone";

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

/** مدن الفروع — slug يطابق قيم الحجز في الواجهة */
const seedCities = [
  { slug: "jeddah", name: "جدة", sortOrder: 10 },
  { slug: "madinah", name: "المدينة المنورة", sortOrder: 20 },
  { slug: "tabuk", name: "تبوك", sortOrder: 30 },
] as const;

/** Branches — see docs/booking-request-branch-fields.md */
const seedBranches = [
  { slug: "jeddah", name: "جدة", citySlug: "jeddah", sortOrder: 10, isNew: false },
  { slug: "madinah", name: "المدينة المنورة", citySlug: "madinah", sortOrder: 20, isNew: false },
  { slug: "tabuk", name: "تبوك", citySlug: "tabuk", sortOrder: 30, isNew: true },
] as const;

const SEED_BOOKING_NAME_PREFIX = "[SEED]";

/** Demo fleet — quantity per branch for each model */
const seedFleetModels = [
  {
    brandName: "Toyota",
    modelName: "Camry",
    year: 2024,
    categorySlug: "sedan",
    chairs: 5,
    engine: "2.5L",
    transmission: "AUTOMATIC" as const,
    fuel: "GASOLINE" as const,
    price: 185,
    quantityPerBranch: 4,
  },
  {
    brandName: "Hyundai",
    modelName: "Tucson",
    year: 2023,
    categorySlug: "suv-4x4",
    chairs: 5,
    engine: "2.0L",
    transmission: "AUTOMATIC" as const,
    fuel: "GASOLINE" as const,
    price: 220,
    quantityPerBranch: 3,
  },
] as const;

/** عملاء الموقع (`User`) — ليسوا موظفي إدارة */
const seedCustomers = [
  {
    email: "heshammoha231992@gmail.com",
    password: "225666",
    name: "Hesham",
    phoneLocalNine: "582187287",
  },
  {
    email: "hesham@gmail.com",
    password: "password",
    name: "Hesham",
    phoneLocalNine: null as string | null,
  },
] as const;

async function seedFleetCategories() {
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
  console.log(`Fleet categories: ${categories.length}`);
}

async function seedBrands() {
  for (const name of brandNames) {
    await prisma.brand.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
  console.log(`Brands: ${brandNames.length}`);
}

async function seedGalleryFolders() {
  const folders = [
    { slug: "vehicles", label: "المركبات", sortOrder: 0 },
    { slug: "categories", label: "الفئات", sortOrder: 1 },
    { slug: "gallery", label: "عام", sortOrder: 2 },
    { slug: "home", label: "الصفحة الرئيسية (هيرو)", sortOrder: 3 },
    { slug: "branches", label: "الفروع", sortOrder: 4 },
  ];
  for (const g of folders) {
    await prisma.galleryFolder.upsert({
      where: { slug: g.slug },
      create: g,
      update: { label: g.label, sortOrder: g.sortOrder },
    });
  }
  console.log(`Gallery folders: ${folders.length}`);
}

async function seedCitiesAndBranches(): Promise<Map<string, number>> {
  const cityIdBySlug = new Map<string, number>();

  for (const city of seedCities) {
    const row = await prisma.city.upsert({
      where: { slug: city.slug },
      create: {
        slug: city.slug,
        name: city.name,
        sortOrder: city.sortOrder,
        isActive: true,
      },
      update: {
        name: city.name,
        sortOrder: city.sortOrder,
        isActive: true,
      },
    });
    cityIdBySlug.set(city.slug, row.id);
  }
  console.log(`Cities: ${seedCities.length}`);

  const branchIdBySlug = new Map<string, number>();

  for (const branch of seedBranches) {
    const cityId = cityIdBySlug.get(branch.citySlug);
    if (!cityId) {
      throw new Error(`City not found for branch ${branch.slug}: ${branch.citySlug}`);
    }
    const row = await prisma.branch.upsert({
      where: { slug: branch.slug },
      create: {
        slug: branch.slug,
        name: branch.name,
        cityId,
        sortOrder: branch.sortOrder,
        isActive: true,
        isNew: branch.isNew,
      },
      update: {
        name: branch.name,
        cityId,
        sortOrder: branch.sortOrder,
        isActive: true,
        isNew: branch.isNew,
      },
    });
    branchIdBySlug.set(branch.slug, row.id);
  }
  console.log(`Branches: ${seedBranches.length}`);

  return branchIdBySlug;
}

async function upsertAdminEmployee(opts: {
  email: string;
  plainPassword: string;
  name: string;
  isSuperAdmin: boolean;
  branchId?: number | null;
}) {
  const email = opts.email.trim().toLowerCase();
  const passwordHash = await hashPassword(opts.plainPassword);
  await prisma.adminEmployee.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: opts.name,
      isSuperAdmin: opts.isSuperAdmin,
      branchId: opts.isSuperAdmin ? null : (opts.branchId ?? null),
      isActive: true,
    },
    update: {
      passwordHash,
      name: opts.name,
      isSuperAdmin: opts.isSuperAdmin,
      branchId: opts.isSuperAdmin ? null : (opts.branchId ?? null),
      isActive: true,
    },
  });
}

async function seedAdminEmployees(branchIdBySlug: Map<string, number>) {
  const superEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "admin@rawaes.sa";
  const superPassword = process.env.ADMIN_PASSWORD ?? "changeme";
  const branchPassword = process.env.SEED_BRANCH_PASSWORD ?? "branch123";

  await upsertAdminEmployee({
    email: superEmail,
    plainPassword: superPassword,
    name: "مدير النظام",
    isSuperAdmin: true,
  });
  console.log(`AdminEmployee (super): ${superEmail} / ${superPassword}`);

  for (const branch of seedBranches) {
    const branchId = branchIdBySlug.get(branch.slug);
    if (!branchId) continue;
    const email = `branch.${branch.slug}@rawaes.sa`;
    await upsertAdminEmployee({
      email,
      plainPassword: branchPassword,
      name: `موظف ${branch.name}`,
      isSuperAdmin: false,
      branchId,
    });
    console.log(`AdminEmployee (branch ${branch.slug}): ${email} / ${branchPassword}`);
  }
}

async function seedCustomerUsers() {
  for (const u of seedCustomers) {
    const passwordHash = await hashPassword(u.password);
    const phone = u.phoneLocalNine ? saudiLocalNineToE164(u.phoneLocalNine) : null;
    if (u.phoneLocalNine && !phone) {
      throw new Error(`Invalid seed phone for ${u.email}: ${u.phoneLocalNine}`);
    }
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        phone,
      },
      update: {
        passwordHash,
        name: u.name,
        phone,
      },
    });
    console.log(
      `User (customer): ${u.email} (password: ${u.password})${phone ? ` phone: ${phone}` : ""}`,
    );
  }
}

function pickupDateForReturnOn(returnYmd: string, rentalDays: number, hourUtc = 10): Date {
  const pickupYmd = addDaysYmd(returnYmd, -rentalDays);
  const [y, m, d] = pickupYmd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hourUtc, 0, 0, 0));
}

function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

async function seedDemoFleet(branchIdBySlug: Map<string, number>): Promise<number[]> {
  const modelIds: number[] = [];

  for (const v of seedFleetModels) {
    const brand = await prisma.brand.findUnique({ where: { name: v.brandName } });
    const category = await prisma.fleetCategory.findUnique({ where: { slug: v.categorySlug } });
    if (!brand || !category) {
      throw new Error(`Missing brand/category for seed vehicle ${v.brandName} ${v.modelName}`);
    }

    const model = await prisma.carModel.upsert({
      where: {
        brandId_name_year: {
          brandId: brand.id,
          name: v.modelName,
          year: v.year,
        },
      },
      create: {
        brandId: brand.id,
        categoryId: category.id,
        name: v.modelName,
        year: v.year,
        chairs: v.chairs,
        engine: v.engine,
        transmission: v.transmission,
        fuel: v.fuel,
        price: v.price,
        vatRatePercent: 15,
        image:
          "https://images.unsplash.com/photo-1621007947382-bcb3c6b4d1b5?auto=format&fit=crop&w=900&q=80",
        alt: `${v.brandName} ${v.modelName}`,
      },
      update: {
        price: v.price,
        categoryId: category.id,
      },
    });
    modelIds.push(model.id);

    for (const branch of seedBranches) {
      const branchId = branchIdBySlug.get(branch.slug);
      if (!branchId) continue;
      await prisma.fleet.upsert({
        where: { modelId_branchId: { modelId: model.id, branchId } },
        create: {
          modelId: model.id,
          branchId,
          quantity: v.quantityPerBranch,
        },
        update: { quantity: v.quantityPerBranch },
      });
    }
  }

  console.log(`Demo fleet: ${seedFleetModels.length} models × ${seedBranches.length} branches`);
  return modelIds;
}

async function seedDemoBookings(
  branchIdBySlug: Map<string, number>,
  carModelId: number,
) {
  const jeddahId = branchIdBySlug.get("jeddah");
  const madinahId = branchIdBySlug.get("madinah");
  const tabukId = branchIdBySlug.get("tabuk");
  if (!jeddahId || !madinahId || !tabukId) {
    throw new Error("Branch ids missing for seed bookings");
  }

  await prisma.bookingRequest.deleteMany({
    where: { fullName: { startsWith: SEED_BOOKING_NAME_PREFIX } },
  });

  const today = todayYmdUtc();
  const tomorrow = addDaysYmd(today, 1);
  const sedan = await prisma.fleetCategory.findUnique({ where: { slug: "sedan" } });

  const rows: Parameters<typeof prisma.bookingRequest.create>[0]["data"][] = [
    {
      kind: "DIRECT",
      carModelId,
      fullName: `${SEED_BOOKING_NAME_PREFIX} نفس الفرع (جدة)`,
      phone: "+966500000001",
      ageRange: "25-35",
      carType: sedan?.slug ?? "sedan",
      branchId: jeddahId,
      returnBranchId: jeddahId,
      pickupMode: "BRANCH",
      pickupDate: pickupDateForReturnOn(tomorrow, 4),
      numberOfDays: 4,
      termsAccepted: true,
      status: "CONFIRMED",
      paymentStatus: "PAID",
    },
    {
      kind: "DIRECT",
      carModelId,
      fullName: `${SEED_BOOKING_NAME_PREFIX} استلام جدة → إرجاع المدينة`,
      phone: "+966500000002",
      ageRange: "35-50",
      carType: sedan?.slug ?? "sedan",
      branchId: jeddahId,
      returnBranchId: madinahId,
      pickupMode: "BRANCH",
      pickupDate: pickupDateForReturnOn(today, 3),
      numberOfDays: 3,
      termsAccepted: true,
      status: "CONFIRMED",
      paymentStatus: "PAID",
    },
    {
      kind: "DIRECT",
      carModelId,
      fullName: `${SEED_BOOKING_NAME_PREFIX} استلام تبوك → إرجاع جدة`,
      phone: "+966500000003",
      ageRange: "25-35",
      carType: sedan?.slug ?? "sedan",
      branchId: tabukId,
      returnBranchId: jeddahId,
      pickupMode: "BRANCH",
      pickupDate: pickupDateForReturnOn(today, 2),
      numberOfDays: 2,
      termsAccepted: true,
      status: "CONFIRMED",
      paymentStatus: "PAID",
    },
    {
      kind: "INQUIRY",
      fullName: `${SEED_BOOKING_NAME_PREFIX} استفسار — المدينة`,
      phone: "+966500000004",
      ageRange: "50+",
      carType: sedan?.slug ?? "sedan",
      branchId: madinahId,
      returnBranchId: madinahId,
      pickupMode: "BRANCH",
      pickupDate: pickupDateForReturnOn(addDaysYmd(today, 5), 2),
      numberOfDays: 2,
      termsAccepted: true,
      status: "NEW",
      paymentStatus: "PENDING",
    },
    {
      kind: "DIRECT",
      carModelId,
      fullName: `${SEED_BOOKING_NAME_PREFIX} توصيل — إرجاع جدة`,
      phone: "+966500000005",
      ageRange: "25-35",
      carType: sedan?.slug ?? "sedan",
      branchId: null,
      returnBranchId: jeddahId,
      pickupMode: "DELIVERY",
      deliveryAddress: "حي الروضة، جدة — عنوان تجريبي",
      deliveryLat: 21.5433,
      deliveryLng: 39.1728,
      pickupDate: pickupDateForReturnOn(tomorrow, 1),
      numberOfDays: 1,
      termsAccepted: true,
      status: "CONFIRMED",
      paymentStatus: "PAID",
    },
  ];

  for (const data of rows) {
    await prisma.bookingRequest.create({ data });
  }

  console.log(`Demo bookings: ${rows.length} (prefix ${SEED_BOOKING_NAME_PREFIX})`);
  console.log(`  • Returns today (${today}): inter-branch rows #2 & #3 — test /admin/branch-returns`);
}

async function seedSubscriptionPlans() {
  const carModel = await prisma.carModel.findFirst({
    orderBy: { id: "asc" },
    include: { brand: true },
  });
  if (!carModel) {
    console.warn(
      "لم يُعرَف موديل سيارة — أضف مركبة من لوحة التحكم ثم أعد seed لخطط الاشتراك.",
    );
    return;
  }

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
      durationOptionsCsv: "3,6,12",
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
      durationOptionsCsv: "3,6,12",
      isActive: true,
      sortOrder: 10,
    },
    update: {
      monthlyPriceSar: 1800,
    },
  });
  console.log(`Subscription plans seeded for CarModel #${carModel.id}`);
}

async function main() {
  console.log("—— Seed start ——");

  await seedFleetCategories();
  await seedBrands();
  await seedGalleryFolders();

  const branchIdBySlug = await seedCitiesAndBranches();
  await seedAdminEmployees(branchIdBySlug);

  await seedCustomerUsers();

  const modelIds = await seedDemoFleet(branchIdBySlug);
  const primaryModelId = modelIds[0];
  if (primaryModelId) {
    await seedDemoBookings(branchIdBySlug, primaryModelId);
  }

  await seedSubscriptionPlans();

  console.log("—— Seed done ——");
  console.log("Docs: docs/booking-request-branch-fields.md");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
