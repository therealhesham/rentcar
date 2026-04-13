"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FuelType, Transmission } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  clearAdminSessionCookie,
  setAdminSessionCookie,
  verifyAdminSession,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  isSpacesConfigured,
  isTrustedSpacesImageUrl,
  uploadImageToSpaces,
} from "@/lib/spaces-upload";

export async function loginAdmin(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const password = String(formData.get("password") ?? "");
  if (!process.env.ADMIN_PASSWORD) {
    return { ok: false, error: "لم يُضبط ADMIN_PASSWORD في البيئة." };
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return { ok: false, error: "كلمة المرور غير صحيحة." };
  }
  await setAdminSessionCookie();
  redirect("/admin");
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}

export async function createFleetVehicle(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const categoryId = Number(formData.get("categoryId"));
  const brandId = Number(formData.get("brandId"));
  const modelName = String(formData.get("modelName") ?? "").trim();
  const year = Number(formData.get("year"));
  const chairs = Number(formData.get("chairs"));
  const engine = String(formData.get("engine") ?? "").trim();
  const transmission = String(formData.get("transmission")) as Transmission;
  const fuel = String(formData.get("fuel")) as FuelType;
  const price = Number(formData.get("price"));
  const quantity = Number(formData.get("quantity") ?? 1);
  const imageFile = formData.get("imageFile");
  const galleryImageUrl = String(formData.get("galleryImageUrl") ?? "").trim();
  const alt = String(formData.get("alt") ?? "").trim() || null;
  const badge = String(formData.get("badge") ?? "").trim() || null;
  const cta = String(formData.get("cta") ?? "").trim() || null;

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
  if (!Number.isFinite(quantity) || quantity < 1) {
    return { ok: false, error: "الكمية غير صالحة." };
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
      image = await uploadImageToSpaces(imageFile, "cars");
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
          brandId: Math.floor(brandId),
          categoryId: Math.floor(categoryId),
          year,
          chairs,
          engine,
          transmission,
          fuel,
          price: Math.round(price),
          image,
          alt,
          cta,
          badge,
        },
      });

      await tx.fleet.create({
        data: {
          modelId: model.id,
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
  return { ok: true };
}
