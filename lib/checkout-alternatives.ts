/**
 * بدائل السيارة غير المتاحة — تُعرض داخل `CarUnavailableModal` بدل أن يُترك الزائر
 * أمام زرّ معطّل.
 *
 * الحساب دفعة واحدة لا موديلاً موديلاً: `listAvailableCarModelIds` تستدعي
 * `getDirectBookingAvailability` في حلقة، أي استعلامين لكل موديل — على ٤٦ موديلاً
 * وقاعدة بعيدة يعني ثواني قبل أن يظهر المودال. هنا نحمّل مخزون الفرع وحجوزاته
 * باستعلامين اثنين ثم نحسب التداخل في الذاكرة.
 */

import {
  NON_BLOCKING_BOOKING_STATUSES,
  countOverlapsFromRows,
} from "@/lib/direct-booking";
import { getCarModelForCheckout, type CheckoutCarDTO } from "@/lib/checkout-car-data";
import { prisma } from "@/lib/prisma";
import { getBookingWidgetTabFlags, getFleetTurnaroundMinutes } from "@/lib/site-settings";

export type CheckoutAlternativeDTO = Pick<
  CheckoutCarDTO,
  | "modelId"
  | "fullTitle"
  | "categoryTitle"
  | "image"
  | "alt"
  | "pricePerDayExclTax"
  | "originalPricePerDayExclTax"
  | "discountLabelAr"
  | "vatRatePercent"
> & {
  /** من نفس فئة السيارة التي تعذّر حجزها — تُقدَّم في الترتيب وتُوسم في الواجهة. */
  sameCategory: boolean;
};

/** سقف ما يُعرض: قائمة أطول تحوّل المودال إلى صفحة أسطول ثانية. */
const DEFAULT_LIMIT = 6;

export async function listCheckoutAlternatives(input: {
  excludeModelId: number;
  pickupDate: Date;
  numberOfDays: number;
  branchSlug: string;
  limit?: number;
}): Promise<CheckoutAlternativeDTO[]> {
  const branchSlug = input.branchSlug.trim().toLowerCase();
  if (!branchSlug) return [];

  const days = Math.max(1, Math.min(60, Math.round(input.numberOfDays) || 1));
  const limit = Math.max(1, Math.min(12, input.limit ?? DEFAULT_LIMIT));

  const stockRows = await prisma.fleet.findMany({
    where: {
      isVisible: true,
      quantity: { gt: 0 },
      branch: { slug: branchSlug, isActive: true },
      modelId: { not: input.excludeModelId },
    },
    select: {
      modelId: true,
      quantity: true,
      model: { select: { price: true, categoryId: true } },
    },
  });
  if (!stockRows.length) return [];

  // نفس الموديل قد يتكرّر عبر أكثر من صف مخزون في الفرع الواحد.
  const byModel = new Map<
    number,
    { units: number; price: number; categoryId: number }
  >();
  for (const row of stockRows) {
    const prev = byModel.get(row.modelId);
    if (prev) prev.units += row.quantity;
    else {
      byModel.set(row.modelId, {
        units: row.quantity,
        price: row.model.price,
        categoryId: row.model.categoryId,
      });
    }
  }

  const excluded = await prisma.carModel.findUnique({
    where: { id: input.excludeModelId },
    select: { categoryId: true },
  });
  const targetCategoryId = excluded?.categoryId ?? null;

  const tabFlags = await getBookingWidgetTabFlags();
  let availableIds: number[];

  if (tabFlags.allowOverbooking) {
    availableIds = [...byModel.keys()];
  } else {
    const bookings = await prisma.bookingRequest.findMany({
      where: {
        kind: "DIRECT",
        carModelId: { in: [...byModel.keys()] },
        NOT: { status: { in: [...NON_BLOCKING_BOOKING_STATUSES] } },
        returnBranch: { slug: branchSlug },
      },
      select: {
        carModelId: true,
        pickupDate: true,
        numberOfDays: true,
        addonsJson: true,
      },
    });

    const rowsByModel = new Map<number, typeof bookings>();
    for (const b of bookings) {
      if (b.carModelId == null) continue;
      const list = rowsByModel.get(b.carModelId);
      if (list) list.push(b);
      else rowsByModel.set(b.carModelId, [b]);
    }

    const turnaroundMinutes = await getFleetTurnaroundMinutes();
    availableIds = [];
    for (const [modelId, info] of byModel) {
      const overlapping = countOverlapsFromRows(
        rowsByModel.get(modelId) ?? [],
        input.pickupDate,
        days,
        { turnaroundMinutes },
      );
      if (overlapping < info.units) availableIds.push(modelId);
    }
  }

  if (!availableIds.length) return [];

  // الترتيب قبل تحميل التسعير الكامل: نفس الفئة أولاً ثم الأرخص، حتى لا نحمّل
  // بيانات موديلات لن تُعرض أصلاً.
  availableIds.sort((a, b) => {
    const ia = byModel.get(a)!;
    const ib = byModel.get(b)!;
    const sameA = targetCategoryId != null && ia.categoryId === targetCategoryId;
    const sameB = targetCategoryId != null && ib.categoryId === targetCategoryId;
    if (sameA !== sameB) return sameA ? -1 : 1;
    return ia.price - ib.price;
  });

  const picked = availableIds.slice(0, limit);

  // التسعير من `getCarModelForCheckout` نفسها لا من حساب موازٍ — سعر الفرع
  // والخصم والأرضية كلها منطق واحد لا يجوز تكراره هنا.
  const dtos = await Promise.all(
    picked.map((modelId) =>
      getCarModelForCheckout(modelId, {
        branchSlug,
        pickupDate: input.pickupDate,
      }),
    ),
  );

  const out: CheckoutAlternativeDTO[] = [];
  for (let i = 0; i < picked.length; i++) {
    const dto = dtos[i];
    if (!dto) continue;
    const info = byModel.get(picked[i])!;
    out.push({
      modelId: dto.modelId,
      fullTitle: dto.fullTitle,
      categoryTitle: dto.categoryTitle,
      image: dto.image,
      alt: dto.alt,
      pricePerDayExclTax: dto.pricePerDayExclTax,
      originalPricePerDayExclTax: dto.originalPricePerDayExclTax,
      discountLabelAr: dto.discountLabelAr,
      vatRatePercent: dto.vatRatePercent,
      sameCategory: targetCategoryId != null && info.categoryId === targetCategoryId,
    });
  }
  return out;
}
