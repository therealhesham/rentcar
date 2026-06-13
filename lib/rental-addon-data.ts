import { prisma } from "@/lib/prisma";
import { localizeDbField } from "@/lib/localize";

export type RentalAddonDTO = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  info: string | null;
  pricePerDay: number;
  iconKey: string | null;
  /** إن وُجدت، لا يُختار أكثر من إضافة واحدة لنفس المجموعة. */
  exclusiveGroup: string | null;
};

export async function getActiveRentalAddons(locale: string = "ar"): Promise<RentalAddonDTO[]> {
  try {
    const rows = await prisma.rentalAddon.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        slug: true,
        titleAr: true,
        titleEn: true,
        descriptionAr: true,
        descriptionEn: true,
        infoAr: true,
        infoEn: true,
        pricePerDay: true,
        iconKey: true,
        exclusiveGroup: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: localizeDbField(r, "title", locale),
      description: localizeDbField(r, "description", locale),
      info: localizeDbField(r, "info", locale),
      pricePerDay: r.pricePerDay,
      iconKey: r.iconKey,
      exclusiveGroup: r.exclusiveGroup,
    }));
  } catch {
    return [];
  }
}
