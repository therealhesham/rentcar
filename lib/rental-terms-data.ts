import { prisma } from "@/lib/prisma";
import { localizeDbField } from "@/lib/localize";

export type RentalTermDTO = {
  id: number;
  title: string;
  body: string;
};

/** الشروط والأحكام الفعّالة مرتبة حسب sortOrder، مترجمة حسب لغة الزائر. */
export async function getActiveRentalTerms(locale: string = "ar"): Promise<RentalTermDTO[]> {
  try {
    const rows = await prisma.rentalTerm.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        titleAr: true,
        titleEn: true,
        bodyAr: true,
        bodyEn: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: localizeDbField(r, "title", locale),
      body: localizeDbField(r, "body", locale),
    }));
  } catch {
    return [];
  }
}
