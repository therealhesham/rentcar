"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

type BookingActionState = { ok: boolean; error?: string };

const AGE_OPTIONS = new Set(["25-35", "35-50", "50+"]);
const CAR_OPTIONS = new Set(["sedan", "suv", "sports"]);
const BRANCH_OPTIONS = new Set(["jeddah", "madinah", "tabuk"]);

type ParsedCommon = {
  fullName: string;
  phone: string;
  ageRange: string;
  branch: string;
  pickupDate: Date;
  numberOfDays: number;
  termsAccepted: boolean;
};

function parseCommonBookingFields(
  formData: FormData,
): { ok: true; data: ParsedCommon } | { ok: false; error: string } {
  const fullName = String(formData.get("name") ?? "").trim();
  const localPhone = String(formData.get("phone") ?? "")
    .replace(/\s+/g, "")
    .trim();
  const ageRange = String(formData.get("age") ?? "");
  const branch = String(formData.get("branch") ?? "");
  const pickupDateRaw = String(formData.get("pickupDate") ?? "");
  const days = Number(formData.get("days"));
  const termsAccepted = formData.get("terms") === "on";

  if (fullName.length < 3) {
    return { ok: false, error: "يرجى إدخال الاسم الكامل بشكل صحيح." };
  }
  if (!/^5\d{8}$/.test(localPhone)) {
    return { ok: false, error: "يرجى إدخال رقم الجوال بدون 966 وبصيغة صحيحة." };
  }
  const phone = `+966${localPhone}`;
  if (!AGE_OPTIONS.has(ageRange)) {
    return { ok: false, error: "الفئة العمرية غير صالحة." };
  }
  if (!BRANCH_OPTIONS.has(branch)) {
    return { ok: false, error: "الفرع غير صالح." };
  }

  const pickupDate = new Date(pickupDateRaw);
  if (!pickupDateRaw || Number.isNaN(pickupDate.getTime())) {
    return { ok: false, error: "يرجى اختيار تاريخ بداية الحجز." };
  }
  if (!Number.isFinite(days) || days < 1 || days > 60) {
    return { ok: false, error: "عدد الأيام يجب أن يكون من 1 إلى 60." };
  }
  if (!termsAccepted) {
    return { ok: false, error: "يجب الموافقة على الشروط والأحكام." };
  }

  return {
    ok: true,
    data: {
      fullName,
      phone,
      ageRange,
      branch,
      pickupDate,
      numberOfDays: Math.round(days),
      termsAccepted,
    },
  };
}

export async function submitBookingRequest(
  _prev: BookingActionState | null,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = parseCommonBookingFields(formData);
  if (!parsed.ok) {
    return parsed;
  }

  const carType = String(formData.get("carType") ?? "");
  if (!CAR_OPTIONS.has(carType)) {
    return { ok: false, error: "نوع السيارة غير صالح." };
  }

  const { data } = parsed;

  try {
    await prisma.bookingRequest.create({
      data: {
        kind: "INQUIRY",
        fullName: data.fullName,
        phone: data.phone,
        ageRange: data.ageRange,
        carType,
        branch: data.branch,
        pickupDate: data.pickupDate,
        numberOfDays: data.numberOfDays,
        termsAccepted: data.termsAccepted,
      },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذّر إرسال الطلب الآن، حاول مرة أخرى." };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function submitDirectBookingRequest(
  _prev: BookingActionState | null,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = parseCommonBookingFields(formData);
  if (!parsed.ok) {
    return parsed;
  }

  const carModelId = Number(formData.get("carModelId"));
  if (!Number.isInteger(carModelId) || carModelId < 1) {
    return { ok: false, error: "معرّف السيارة غير صالح." };
  }

  const model = await prisma.carModel.findUnique({
    where: { id: carModelId },
    include: { category: true },
  });
  if (!model) {
    return { ok: false, error: "السيارة غير موجودة." };
  }

  const fleetRow = await prisma.fleet.findFirst({
    where: { modelId: carModelId, quantity: { gt: 0 } },
  });
  if (!fleetRow) {
    return { ok: false, error: "هذه السيارة غير متاحة للحجز حالياً." };
  }

  const carType = model.category.slug || model.category.title;
  const { data } = parsed;

  try {
    await prisma.bookingRequest.create({
      data: {
        kind: "DIRECT",
        carModelId,
        fullName: data.fullName,
        phone: data.phone,
        ageRange: data.ageRange,
        carType,
        branch: data.branch,
        pickupDate: data.pickupDate,
        numberOfDays: data.numberOfDays,
        termsAccepted: data.termsAccepted,
      },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذّر إرسال الطلب الآن، حاول مرة أخرى." };
  }

  revalidatePath("/admin");
  revalidatePath("/fleet");
  return { ok: true };
}
