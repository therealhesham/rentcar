import { prisma } from "@/lib/prisma";
import { localizeDbField } from "@/lib/localize";

export type CheckoutOneTimeFeeLine = {
  slug: string;
  label: string;
  feeExclVatSar: number;
};

/** رسوم إتمام الحجز النشطة (للعرض في الـ checkout ولقطعة الحجز على الخادم). */
export async function getActiveCheckoutOneTimeFees(locale: string = "ar"): Promise<CheckoutOneTimeFeeLine[]> {
  const rows = await prisma.checkoutOneTimeFee.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { slug: true, labelAr: true, labelEn: true, feeExclVatSar: true },
  });
  return rows
    .filter((r) => r.feeExclVatSar > 0)
    .map((r) => ({
      slug: r.slug.trim().toLowerCase(),
      label: localizeDbField({ ...r, label: r.labelAr }, "label", locale).trim(),
      feeExclVatSar: Math.round(r.feeExclVatSar),
    }));
}

export function sumCheckoutOneTimeFees(lines: ReadonlyArray<CheckoutOneTimeFeeLine>): number {
  return lines.reduce((s, x) => s + Math.max(0, Math.round(x.feeExclVatSar)), 0);
}
