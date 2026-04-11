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
    const brandName = m.brand.name;
    const title = `${brandName} ${m.name}`.trim();
    const subtitle = `${m.year} • ${FUEL_AR[m.fuel]} • ${TRANS_AR[m.transmission]}`;
    const price = m.price.toLocaleString("en-US");

    return {
      id: row.id,
      modelId: row.modelId,
      name: title,
      subtitle,
      price,
      image: m.image?.trim() || PLACEHOLDER_IMG,
      alt: m.alt?.trim() || title,
      badge: m.badge,
      specs: [
        { icon: "mode_fan", label: m.engine },
        { icon: "speed", label: TRANS_AR[m.transmission] },
        {
          icon: "airline_seat_recline_extra",
          label: `${m.chairs} مقاعد`,
        },
      ],
    };
  });
}
