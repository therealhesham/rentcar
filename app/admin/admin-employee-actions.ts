"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { isKnownAdminPermission } from "@/lib/admin-permissions";

export async function createAdminEmployee(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const branchId = Number(formData.get("branchId"));
  const cityId = Number(formData.get("cityId"));
  const notifyOnBookingEmail =
    formData.get("notifyOnBookingEmail") === "on" || formData.get("notifyOnBookingEmail") === "true";
  const notifyGlobalTo =
    formData.get("notifyGlobalTo") === "on" || formData.get("notifyGlobalTo") === "true";
  const notifyGlobalCc =
    formData.get("notifyGlobalCc") === "on" || formData.get("notifyGlobalCc") === "true";
  const permissions = formData
    .getAll("permissions")
    .map(String)
    .filter(isKnownAdminPermission);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "أدخل بريداً إلكترونياً صالحاً." };
  }
  if (password.length < 6) {
    return { ok: false, error: "كلمة المرور 6 أحرف على الأقل." };
  }

  const hasBranch = Number.isInteger(branchId) && branchId > 0;
  const hasCity = Number.isInteger(cityId) && cityId > 0;
  if (hasBranch && hasCity) {
    return { ok: false, error: "اختر فرعاً واحداً أو مدينة كاملة، لا الاثنين معاً." };
  }

  let finalBranchId: number | null = null;
  if (hasBranch) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      return { ok: false, error: "الفرع غير موجود أو غير نشط." };
    }
    finalBranchId = branch.id;
  }

  let finalCityId: number | null = null;
  if (hasCity) {
    const city = await prisma.city.findUnique({
      where: { id: cityId, isActive: true },
      select: { id: true },
    });
    if (!city) {
      return { ok: false, error: "المدينة غير موجودة أو غير نشطة." };
    }
    finalCityId = city.id;
  }

  const exists = await prisma.adminEmployee.findUnique({ where: { email } });
  if (exists) {
    return { ok: false, error: "هذا البريد مستخدم لحساب إداري آخر." };
  }

  await prisma.adminEmployee.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      name: name || null,
      branchId: finalBranchId,
      cityId: finalCityId,
      isSuperAdmin: false,
      isActive: true,
      permissionsJson: JSON.stringify(permissions),
      notifyOnBookingEmail,
      notifyGlobalTo,
      notifyGlobalCc,
    },
  });

  revalidatePath("/admin/employees");
  return { ok: true };
}

export async function setAdminEmployeeActive(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("employeeId"));
  const isActive = String(formData.get("isActive")) === "true";

  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف الموظف غير صالح." };
  }

  const row = await prisma.adminEmployee.findUnique({
    where: { id },
    select: { isSuperAdmin: true },
  });
  if (!row) return { ok: false, error: "الموظف غير موجود." };
  if (row.isSuperAdmin) {
    return { ok: false, error: "لا يمكن تعطيل حساب مدير النظام من هنا." };
  }

  await prisma.adminEmployee.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath("/admin/employees");
  return { ok: true };
}

/**
 * تعديل صلاحيات موظف فرع موجود بالفعل — لا يوجد مسار آخر لتعديل حساب بعد إنشائه
 * (فورم الإضافة يحدّد الصلاحيات مرة واحدة فقط عند الإنشاء).
 * القيم تُفلتَر على قائمة الصلاحيات المعروفة — لا تُحفظ أي قيمة غريبة قادمة
 * من الفورم مباشرةً في العمود.
 */
export async function updateAdminEmployeePermissions(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("employeeId"));
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف الموظف غير صالح." };
  }

  const permissions = formData
    .getAll("permissions")
    .map(String)
    .filter(isKnownAdminPermission);

  const row = await prisma.adminEmployee.findUnique({
    where: { id },
    select: { isSuperAdmin: true },
  });
  if (!row) return { ok: false, error: "الموظف غير موجود." };
  if (row.isSuperAdmin) {
    return { ok: false, error: "صلاحيات مدير النظام غير قابلة للتعديل من هنا." };
  }

  await prisma.adminEmployee.update({
    where: { id },
    data: { permissionsJson: JSON.stringify(permissions) },
  });

  revalidatePath("/admin/employees");
  return { ok: true };
}

/**
 * تعديل تفضيلات إشعار الإيميل لموظف موجود: تفعيل/تعطيل، مشرف مدينة (cityId)،
 * TO عام أو CC عام على كل الحجوزات — بمعزل عن الفرع/المدينة.
 */
export async function updateAdminEmployeeNotificationPref(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("employeeId"));
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف الموظف غير صالح." };
  }

  const notifyOnBookingEmail =
    formData.get("notifyOnBookingEmail") === "on" || formData.get("notifyOnBookingEmail") === "true";
  const notifyGlobalTo =
    formData.get("notifyGlobalTo") === "on" || formData.get("notifyGlobalTo") === "true";
  const notifyGlobalCc =
    formData.get("notifyGlobalCc") === "on" || formData.get("notifyGlobalCc") === "true";
  const cityId = Number(formData.get("cityId"));
  const hasCity = Number.isInteger(cityId) && cityId > 0;

  const row = await prisma.adminEmployee.findUnique({
    where: { id },
    select: { isSuperAdmin: true, branchId: true },
  });
  if (!row) return { ok: false, error: "الموظف غير موجود." };
  if (row.isSuperAdmin) {
    return { ok: false, error: "إعدادات مدير النظام غير قابلة للتعديل من هنا." };
  }
  if (hasCity && row.branchId != null) {
    return { ok: false, error: "لا يمكن ضبط مدينة لموظف مرتبط بفرع محدد." };
  }

  let finalCityId: number | null = null;
  if (hasCity) {
    const city = await prisma.city.findUnique({
      where: { id: cityId, isActive: true },
      select: { id: true },
    });
    if (!city) return { ok: false, error: "المدينة غير موجودة أو غير نشطة." };
    finalCityId = city.id;
  }

  await prisma.adminEmployee.update({
    where: { id },
    data: { notifyOnBookingEmail, notifyGlobalTo, notifyGlobalCc, cityId: finalCityId },
  });

  revalidatePath("/admin/employees");
  return { ok: true };
}
