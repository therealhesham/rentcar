"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

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
  const permissions = formData.getAll("permissions").map(String);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "أدخل بريداً إلكترونياً صالحاً." };
  }
  if (password.length < 6) {
    return { ok: false, error: "كلمة المرور 6 أحرف على الأقل." };
  }

  let finalBranchId: number | null = null;
  if (Number.isInteger(branchId) && branchId > 0) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      return { ok: false, error: "الفرع غير موجود أو غير نشط." };
    }
    finalBranchId = branch.id;
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
      isSuperAdmin: false,
      isActive: true,
      permissionsJson: JSON.stringify(permissions),
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
