import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import { parseBranchOpeningHoursJson } from "@/lib/branch-opening-hours";
import {
  computeCityCenterFromBranchCoords,
  parseLatLngFromMapUrl,
} from "@/lib/delivery-origin-city";
import { prisma } from "@/lib/prisma";

const PLACEHOLDER_BRANCH_IMG =
  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&q=80";

const citySelect = {
  id: true,
  slug: true,
  name: true,
  sortOrder: true,
} as const;

/** فروع مفعّلة ومعلّمة كجديدة لقسم الصفحة الرئيسية */
export async function getNewBranchesForHome() {
  try {
    return await prisma.branch.findMany({
      where: { isActive: true, isNew: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { city: { select: citySelect } },
    });
  } catch {
    return [];
  }
}

/** كل الفروع المفعّلة (مستخدمة في من نحن وغيرها) */
export async function getActiveBranches() {
  try {
    return await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { city: { select: citySelect } },
    });
  } catch {
    return [];
  }
}

/** مدن نشطة مع فروعها للحجز من الرئيسية وصفحة إتمام الحجز */
export async function getActiveBookingCitiesWithBranches(): Promise<
  BookingCityBranchesOption[]
> {
  try {
    const rows = await prisma.city.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        branches: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: {
            slug: true,
            name: true,
            openingHoursJson: true,
            mapUrl: true,
          },
        },
      },
    });
    return rows
      .filter((c) => c.branches.length > 0)
      .map((c) => {
        const branchCoords = c.branches
          .map((b) => parseLatLngFromMapUrl(b.mapUrl))
          .filter((p): p is NonNullable<typeof p> => p != null);
        const center = computeCityCenterFromBranchCoords(c.slug, branchCoords);
        return {
          slug: c.slug,
          name: c.name,
          centerLat: center?.lat ?? null,
          centerLng: center?.lng ?? null,
          branches: c.branches.map((b) => ({
            slug: b.slug,
            name: b.name,
            openingHours: parseBranchOpeningHoursJson(b.openingHoursJson),
          })),
        };
      });
  } catch {
    return [];
  }
}

export function branchImageUrl(image: string | null | undefined): string {
  const u = image?.trim();
  return u || PLACEHOLDER_BRANCH_IMG;
}
