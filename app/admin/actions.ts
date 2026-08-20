"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FuelType, Transmission } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { clearAdminSessionCookie, setAdminSessionCookie } from "@/lib/admin-auth";
import { currentRequestMeta, logActivity } from "@/lib/activity-log";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { effectivePermissions } from "@/lib/admin-job-roles";
import { verifyPassword } from "@/lib/password";
import { requireGalleryFolderSlug } from "@/lib/gallery-folder";
import { prisma } from "@/lib/prisma";
import {
  isSpacesConfigured,
  isTrustedSpacesImageUrl,
  uploadImageToSpaces,
} from "@/lib/spaces-upload";

export type AdminLoginState = { ok: true } | { ok: false; error: string };

/**
 * حد أدنى اختياري للسعر (دون ضريبة) من الفورم.
 * غياب الحقل = لا تغيير (undefined)؛ حقل فارغ = مسح الحد (null).
 */
function parseOptionalPriceFloor(
  raw: FormDataEntryValue | null,
  label: string,
  max: number,
): { ok: true; value: number | null | undefined } | { ok: false; error: string } {
  if (raw == null) return { ok: true, value: undefined };
  const trimmed = String(raw).trim();
  if (trimmed === "") return { ok: true, value: null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
    return { ok: false, error: `${label} غير صالح.` };
  }
  return { ok: true, value: Math.round(parsed * 100) / 100 };
}

export async function loginAdmin(
  _prev: AdminLoginState | null,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "أدخل البريد وكلمة المرور." };
  }

  const employee = await prisma.adminEmployee.findUnique({
    where: { email },
    include: {
      branch: { select: { id: true, slug: true, name: true } },
      city: { select: { id: true, name: true } },
      jobRole: { select: { permissionsJson: true, isActive: true } },
    },
  });

  if (employee?.isActive) {
    const match = await verifyPassword(password, employee.passwordHash);
    if (!match) {
      return { ok: false, error: "البريد أو كلمة المرور غير صحيحة." };
    }
    // الصلاحيات الفعلية = صلاحيات الوظيفة + الإضافات الفردية؛ الوظيفة المعطّلة لا تمنح شيئاً.
    const permissions = effectivePermissions({
      permissionsJson: employee.permissionsJson,
      jobRole: employee.jobRole?.isActive ? employee.jobRole : null,
    });

    if (!employee.isSuperAdmin && !employee.branch && permissions.length === 0) {
      return { ok: false, error: "حسابك غير مرتبط بفرع ولا يملك أي صلاحيات. تواصل مع مدير النظام." };
    }
    await setAdminSessionCookie({
      employeeId: employee.id,
      isSuperAdmin: employee.isSuperAdmin,
      branchId: employee.branch?.id ?? null,
      branchSlug: employee.branch?.slug ?? null,
      branchName: employee.branch?.name ?? null,
      cityId: employee.city?.id ?? null,
      cityName: employee.city?.name ?? null,
      displayName: employee.email,
      permissions,
    });
    const meta = await currentRequestMeta();
    await logActivity({
      kind: "ADMIN_LOGIN",
      actorLabel: `${employee.name?.trim() || employee.email} <${employee.email}>`,
      ...meta,
    });
    return { ok: true };
  }

  const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD;
  if (envEmail && envPassword && email === envEmail && password === envPassword) {
    await setAdminSessionCookie({
      employeeId: null,
      isSuperAdmin: true,
      branchId: null,
      branchSlug: null,
      branchName: null,
      cityId: null,
      cityName: null,
      displayName: email,
      permissions: [],
    });

    const meta = await currentRequestMeta();
    await logActivity({
      kind: "ADMIN_LOGIN",
      actorLabel: `مدير النظام <${email}>`,
      ...meta,
    });
    return { ok: true };
  }

  return { ok: false, error: "البريد أو كلمة المرور غير صحيحة." };
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}

export async function createFleetVehicle(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const categoryId = Number(formData.get("categoryId"));
  const brandId = Number(formData.get("brandId"));
  const modelName = String(formData.get("modelName") ?? "").trim();
  const nameEn = String(formData.get("nameEn") ?? "").trim() || null;
  const year = Number(formData.get("year"));
  const chairs = Number(formData.get("chairs"));
  const engine = String(formData.get("engine") ?? "").trim();
  const transmission = String(formData.get("transmission")) as Transmission;
  const fuel = String(formData.get("fuel")) as FuelType;
  const price = Number(formData.get("price"));
  const vatRatePercentRaw = Number(formData.get("vatRatePercent"));
  const quantity = Number(formData.get("quantity") ?? 1);
  const branchIdRaw = Number(formData.get("branchId"));
  const imageFile = formData.get("imageFile");
  const galleryImageUrl = String(formData.get("galleryImageUrl") ?? "").trim();
  const alt = String(formData.get("alt") ?? "").trim() || null;
  const badge = String(formData.get("badge") ?? "").trim() || null;
  const badgeEn = String(formData.get("badgeEn") ?? "").trim() || null;
  const cta = String(formData.get("cta") ?? "").trim() || null;
  const ctaEn = String(formData.get("ctaEn") ?? "").trim() || null;

  if (!Number.isFinite(categoryId) || categoryId < 1) {
    return { ok: false, error: "اختر فئة الأسطول." };
  }
  const categoryExists = await prisma.fleetCategory.findUnique({
    where: { id: Math.floor(categoryId) },
  });
  if (!categoryExists) {
    return { ok: false, error: "الفئة غير موجودة." };
  }

  if (!Number.isFinite(brandId) || brandId < 1) {
    return { ok: false, error: "اختر الماركة." };
  }
  const brandExists = await prisma.brand.findUnique({
    where: { id: Math.floor(brandId) },
  });
  if (!brandExists) {
    return { ok: false, error: "الماركة غير موجودة." };
  }
  if (!modelName) {
    return { ok: false, error: "أدخل اسم الموديل." };
  }
  if (!Number.isFinite(year) || year < 1990 || year > 2035) {
    return { ok: false, error: "سنة غير صالحة." };
  }
  if (!Number.isFinite(chairs) || chairs < 1 || chairs > 50) {
    return { ok: false, error: "عدد المقاعد غير صالح." };
  }
  if (!engine) {
    return { ok: false, error: "أدخل وصف المحرك أو الأداء." };
  }
  if (transmission !== "MANUAL" && transmission !== "AUTOMATIC") {
    return { ok: false, error: "ناقل الحركة غير صالح." };
  }
  if (!["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC"].includes(fuel)) {
    return { ok: false, error: "نوع الوقود غير صالح." };
  }
  if (!Number.isFinite(price) || price < 1) {
    return { ok: false, error: "السعر غير صالح." };
  }
  const vatRatePercent = Number.isFinite(vatRatePercentRaw)
    ? Math.round(vatRatePercentRaw)
    : 15;
  if (vatRatePercent < 0 || vatRatePercent > 100) {
    return { ok: false, error: "نسبة الضريبة يجب أن تكون بين 0 و 100." };
  }

  const minDailyFloor = parseOptionalPriceFloor(
    formData.get("minPricePerDayExclTax"),
    "الحد الأدنى للسعر اليومي",
    100000,
  );
  if (!minDailyFloor.ok) return minDailyFloor;
  const minMonthlyFloor = parseOptionalPriceFloor(
    formData.get("minPriceMonthlyExclTax"),
    "الحد الأدنى للسعر الشهري",
    1000000,
  );
  if (!minMonthlyFloor.ok) return minMonthlyFloor;
  if (minDailyFloor.value != null && minDailyFloor.value > price) {
    return { ok: false, error: "الحد الأدنى للسعر اليومي أعلى من السعر اليومي نفسه." };
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    return { ok: false, error: "الكمية غير صالحة." };
  }
  if (!Number.isInteger(branchIdRaw) || branchIdRaw < 1) {
    return { ok: false, error: "اختر فرع الإسطول." };
  }
  const branchExists = await prisma.branch.findFirst({
    where: { id: branchIdRaw, isActive: true },
    select: { id: true },
  });
  if (!branchExists) {
    return { ok: false, error: "الفرع غير موجود أو غير مفعّل." };
  }

  let image: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    if (!isSpacesConfigured()) {
      return {
        ok: false,
        error:
          "لم يُضبط تخزين Spaces لرفع الصور (SPACES_REGION، المفاتيح، SPACES_BUCKET).",
      };
    }
    try {
      await requireGalleryFolderSlug("vehicles");
      image = await uploadImageToSpaces(imageFile, "vehicles");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل رفع صورة السيارة.";
      return { ok: false, error: msg };
    }
  } else if (galleryImageUrl) {
    if (!isTrustedSpacesImageUrl(galleryImageUrl)) {
      return { ok: false, error: "رابط صورة المعرض غير صالح." };
    }
    image = galleryImageUrl;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const model = await tx.carModel.create({
        data: {
          name: modelName,
          nameEn,
          brandId: Math.floor(brandId),
          categoryId: Math.floor(categoryId),
          year,
          chairs,
          engine,
          transmission,
          fuel,
          price: Math.round(price),
          vatRatePercent,
          minPricePerDayExclTax: minDailyFloor.value ?? null,
          minPriceMonthlyExclTax: minMonthlyFloor.value ?? null,
          image,
          alt,
          cta,
          ctaEn,
          badge,
          badgeEn,
        },
      });

      await tx.fleet.create({
        data: {
          modelId: model.id,
          branchId: branchIdRaw,
          quantity: Math.round(quantity),
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: "يوجد موديل بنفس الماركة والاسم والسنة. عدّل الاسم أو السنة.",
      };
    }
    console.error(e);
    return { ok: false, error: "تعذّر الحفظ. تحقق من الاتصال بقاعدة البيانات." };
  }

  revalidatePath("/fleet");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/vehicles");
  revalidatePath("/admin/vehicles/new");
  return { ok: true };
}

export async function updateFleetVehicle(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const modelId = Number(formData.get("modelId"));
  if (!Number.isFinite(modelId) || modelId < 1) {
    return { ok: false, error: "معرّف السيارة غير صالح." };
  }

  const existing = await prisma.carModel.findUnique({
    where: { id: Math.floor(modelId) },
    include: { fleetItems: true },
  });
  if (!existing) {
    return { ok: false, error: "السيارة غير موجودة." };
  }

  const modelName = String(formData.get("modelName") ?? "").trim();
  const nameEn = String(formData.get("nameEn") ?? "").trim() || null;
  const chairs = Number(formData.get("chairs"));
  const engine = String(formData.get("engine") ?? "").trim();
  const transmission = String(formData.get("transmission")) as Transmission;
  const fuel = String(formData.get("fuel")) as FuelType;
  const price = Number(formData.get("price"));
  const vatRatePercentRaw = Number(formData.get("vatRatePercent"));
  const quantity = Number(formData.get("quantity") ?? 0);
  const imageFile = formData.get("imageFile");
  const galleryImageUrl = String(formData.get("galleryImageUrl") ?? "").trim();
  const alt = String(formData.get("alt") ?? "").trim() || null;
  const badge = String(formData.get("badge") ?? "").trim() || null;
  const badgeEn = String(formData.get("badgeEn") ?? "").trim() || null;
  const cta = String(formData.get("cta") ?? "").trim() || null;
  const ctaEn = String(formData.get("ctaEn") ?? "").trim() || null;

  if (!modelName) {
    return { ok: false, error: "أدخل اسم الموديل." };
  }
  if (!Number.isFinite(chairs) || chairs < 1 || chairs > 50) {
    return { ok: false, error: "عدد المقاعد غير صالح." };
  }
  if (!engine) {
    return { ok: false, error: "أدخل وصف المحرك أو الأداء." };
  }
  if (transmission !== "MANUAL" && transmission !== "AUTOMATIC") {
    return { ok: false, error: "ناقل الحركة غير صالح." };
  }
  if (!["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC"].includes(fuel)) {
    return { ok: false, error: "نوع الوقود غير صالح." };
  }
  if (!Number.isFinite(price) || price < 1) {
    return { ok: false, error: "السعر غير صالح." };
  }
  const vatRatePercent = Number.isFinite(vatRatePercentRaw)
    ? Math.round(vatRatePercentRaw)
    : existing.vatRatePercent;
  if (vatRatePercent < 0 || vatRatePercent > 100) {
    return { ok: false, error: "نسبة الضريبة يجب أن تكون بين 0 و 100." };
  }

  const minDailyFloor = parseOptionalPriceFloor(
    formData.get("minPricePerDayExclTax"),
    "الحد الأدنى للسعر اليومي",
    100000,
  );
  if (!minDailyFloor.ok) return minDailyFloor;
  const minMonthlyFloor = parseOptionalPriceFloor(
    formData.get("minPriceMonthlyExclTax"),
    "الحد الأدنى للسعر الشهري",
    1000000,
  );
  if (!minMonthlyFloor.ok) return minMonthlyFloor;
  if (minDailyFloor.value != null && minDailyFloor.value > price) {
    return { ok: false, error: "الحد الأدنى للسعر اليومي أعلى من السعر اليومي نفسه." };
  }
  const monthlyPrice = parseOptionalPriceFloor(
    formData.get("priceMonthlyExclTax"),
    "السعر الشهري",
    1000000,
  );
  if (!monthlyPrice.ok) return monthlyPrice;
  if (
    minMonthlyFloor.value != null &&
    monthlyPrice.value != null &&
    minMonthlyFloor.value > monthlyPrice.value
  ) {
    return { ok: false, error: "الحد الأدنى للسعر الشهري أعلى من السعر الشهري نفسه." };
  }
  if (!Number.isFinite(quantity) || quantity < 0) {
    return { ok: false, error: "الكمية غير صالحة." };
  }

  let image: string | null = existing.image;
  if (imageFile instanceof File && imageFile.size > 0) {
    if (!isSpacesConfigured()) {
      return {
        ok: false,
        error:
          "لم يُضبط تخزين Spaces لرفع الصور (SPACES_REGION، المفاتيح، SPACES_BUCKET).",
      };
    }
    try {
      await requireGalleryFolderSlug("vehicles");
      image = await uploadImageToSpaces(imageFile, "vehicles");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل رفع صورة السيارة.";
      return { ok: false, error: msg };
    }
  } else if (galleryImageUrl) {
    if (!isTrustedSpacesImageUrl(galleryImageUrl)) {
      return { ok: false, error: "رابط صورة المعرض غير صالح." };
    }
    image = galleryImageUrl;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.carModel.update({
        where: { id: existing.id },
        data: {
          name: modelName,
          nameEn,
          chairs: Math.floor(chairs),
          engine,
          transmission,
          fuel,
          price: Math.round(price),
          vatRatePercent,
          // غياب الحقل من الفورم = لا تغيير، حتى لا يمسح فورمٌ آخر الحدود المضبوطة.
          ...(monthlyPrice.value === undefined ? {} : { priceMonthlyExclTax: monthlyPrice.value }),
          ...(minDailyFloor.value === undefined
            ? {}
            : { minPricePerDayExclTax: minDailyFloor.value }),
          ...(minMonthlyFloor.value === undefined
            ? {}
            : { minPriceMonthlyExclTax: minMonthlyFloor.value }),
          image,
          alt,
          cta,
          ctaEn,
          badge,
          badgeEn,
        },
      });
      const editBranchId = Number(formData.get("fleetBranchId"));
      if (Number.isInteger(editBranchId) && editBranchId > 0) {
        await tx.fleet.upsert({
          where: {
            modelId_branchId: { modelId: existing.id, branchId: editBranchId },
          },
          create: {
            modelId: existing.id,
            branchId: editBranchId,
            quantity: Math.max(0, Math.round(quantity)),
          },
          update: { quantity: Math.max(0, Math.round(quantity)) },
        });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: "يوجد موديل بنفس الماركة والاسم والسنة. عدّل الاسم.",
      };
    }
    console.error(e);
    return { ok: false, error: "تعذّر الحفظ. تحقق من الاتصال بقاعدة البيانات." };
  }

  revalidatePath("/fleet");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/vehicles");
  revalidatePath("/admin/vehicles/new");
  revalidatePath(`/admin/vehicles/${existing.id}/edit`);
  return { ok: true };
}

export async function updateVehicleField(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const modelId = Number(formData.get("modelId"));
  const field = formData.get("field") as string;
  const value = formData.get("value") as string;

  if (!Number.isFinite(modelId) || modelId < 1 || !field || !value) {
    return { ok: false, error: "بيانات غير مكتملة." };
  }

  let data: any = {};
  if (field === "minPricePerDayExclTax" || field === "minPriceMonthlyExclTax") {
    // حد أدنى للسعر: صفر يعادل "بلا حد" فعلياً، فنسمح به بعكس باقي الحقول.
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      return { ok: false, error: "قيمة غير صالحة." };
    }
    data[field] = num;
  } else if (
    field === "chairs" ||
    field === "year" ||
    field === "price" ||
    field === "priceMonthlyExclTax" ||
    field === "categoryId"
  ) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 1) {
      return { ok: false, error: "قيمة غير صالحة." };
    }
    data[field] = num;
  } else {
    return { ok: false, error: "حقل غير مدعوم." };
  }

  try {
    await prisma.carModel.update({
      where: { id: modelId },
      data,
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذّر الحفظ." };
  }

  revalidatePath("/fleet");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/vehicles");
  return { ok: true };
}
