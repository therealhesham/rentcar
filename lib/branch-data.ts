import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import { parseBranchOpeningHoursJson } from "@/lib/branch-opening-hours";
import { computeCityCenterFromBranchCoords, parseLatLngFromMapUrl } from "@/lib/delivery-origin-city";
import { prisma } from "@/lib/prisma";
import { localizeDbField } from "@/lib/localize";

const PLACEHOLDER_BRANCH_IMG =
  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&q=80";

const citySelect = {
  id: true,
  slug: true,
  name: true,
  nameEn: true,
  sortOrder: true,
} as const;

/** فروع مفعّلة ومعلّمة كجديدة لقسم الصفحة الرئيسية */
export async function getNewBranchesForHome(locale: string = "ar") {
  try {
    const rows = await prisma.branch.findMany({
      where: { isActive: true, isNew: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { city: { select: citySelect } },
    });
    return rows.map((r) => ({
      ...r,
      name: localizeDbField(r, "name", locale),
      tagline: localizeDbField(r, "tagline", locale),
      address: localizeDbField(r, "address", locale),
      city: { ...r.city, name: localizeDbField(r.city, "name", locale) },
    }));
  } catch {
    return [];
  }
}

/** كل الفروع المفعّلة (مستخدمة في من نحن وغيرها) */
export async function getActiveBranches(locale: string = "ar") {
  try {
    const rows = await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { city: { select: citySelect } },
    });
    return rows.map((r) => ({
      ...r,
      name: localizeDbField(r, "name", locale),
      tagline: localizeDbField(r, "tagline", locale),
      address: localizeDbField(r, "address", locale),
      city: { ...r.city, name: localizeDbField(r.city, "name", locale) },
    }));
  } catch {
    return [];
  }
}

/** مدن نشطة مع فروعها للحجز من الرئيسية وصفحة إتمام الحجز */
export async function getActiveBookingCitiesWithBranches(
  locale: string = "ar",
): Promise<
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
            nameEn: true,
            address: true,
            addressEn: true,
            phone: true,
            openingHoursJson: true,
            mapUrl: true,
            latitude: true,
            longitude: true,
            deliveryFeePerKmSar: true,
          },
        },
      },
    });
    return rows
      .filter((c) => c.branches.length > 0)
      .map((c) => {
        const branchCoords = c.branches
          .map((b) => {
            if (b.latitude != null && b.longitude != null) {
              return { lat: b.latitude, lng: b.longitude };
            }
            return parseLatLngFromMapUrl(b.mapUrl);
          })
          .filter((p): p is NonNullable<typeof p> => p != null);
        const center = computeCityCenterFromBranchCoords(c.slug, branchCoords);
        return {
          slug: c.slug,
          name: localizeDbField(c, "name", locale),
          centerLat: center?.lat ?? null,
          centerLng: center?.lng ?? null,
          branches: c.branches.map((b) => {
            let lat = b.latitude;
            let lng = b.longitude;
            if (lat == null || lng == null) {
              const loc = parseLatLngFromMapUrl(b.mapUrl);
              lat = loc?.lat ?? null;
              lng = loc?.lng ?? null;
            }
            return {
              slug: b.slug,
              name: localizeDbField(b, "name", locale),
              address: localizeDbField(b, "address", locale),
              phone: b.phone ?? null,
              openingHours: parseBranchOpeningHoursJson(b.openingHoursJson),
              lat,
              lng,
              mapUrl: b.mapUrl,
              deliveryFeePerKmSar: b.deliveryFeePerKmSar,
            };
          }),
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
