import type { FuelType, Transmission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FleetCar } from "@/lib/fleet-types";

const FUEL_AR: Record<FuelType, string> = {
  GASOLINE: "بنزين",
  DIESEL: "ديزل",
  HYBRID: "هجين",
  ELECTRIC: "كهرباء",
};

const TRANS_AR: Record<Transmission, string> = {
  MANUAL: "يدوي",
  AUTOMATIC: "أوتوماتيك",
};

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80";

export async function getFleetCarsForDisplay(
  categorySlug?: string | null,
): Promise<FleetCar[]> {
  const rows = await prisma.fleet.findMany({
    where: {
      quantity: { gt: 0 },
      ...(categorySlug
        ? {
            model: {
              category: { slug: categorySlug },
            },
          }
        : {}),
    },
    include: {
      model: {
        include: { brand: true, category: true },
      },
    },
    orderBy: { id: "desc" },
  });

  return rows.map((row) => {
    const m = row.model;
    const brandName = m.brand.name.trim();
    const modelName = m.name.trim();
    const fullTitle = `${brandName} ${modelName}`.trim();
    const subtitle = `${m.year} • ${FUEL_AR[m.fuel]} • ${TRANS_AR[m.transmission]}`;
    const price = m.price.toLocaleString("en-US");
    /** غير مخزّن في قاعدة البيانات — تقدير بسيط للعرض حسب حجم المركبة */
    const displayDoors = m.chairs >= 7 ? 5 : 4;
    const displayLuggage = m.chairs >= 7 ? 4 : m.chairs >= 6 ? 3 : 2;

    return {
      id: row.id,
      modelId: row.modelId,
      brand: brandName,
      name: modelName,
      year: m.year,
      fullTitle,
      subtitle,
      price,
      image: m.image?.trim() || PLACEHOLDER_IMG,
      alt: m.alt?.trim() || fullTitle,
      badge: m.badge,
      specs: [
        { icon: "door_open", value: String(displayDoors) },
        { icon: "airline_seat_recline_extra", value: String(m.chairs) },
        { icon: "luggage", value: String(displayLuggage) },
      ],
    };
  });
}
