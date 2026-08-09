"use server";

import { requireAdminForAction } from "@/lib/admin-access";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 6;

/**
 * يغيّر الموظف المسجّل دخوله كلمة مروره هو فقط — المعرّف يُقرأ من الجلسة لا من الفورم،
 * ويُشترط إدخال كلمة المرور الحالية. مدير النظام البيئي (ADMIN_EMAIL) كلمة مروره في
 * متغيّرات البيئة ولا صف له في الجدول، فلا يمكن تغييرها من هنا.
 */
export async function updateMyAdminPassword(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const employeeId = auth.session.employeeId;
  if (employeeId == null) {
    return {
      ok: false,
      error:
        "هذا الحساب هو مدير النظام المعرَّف في بيئة الخادم (ADMIN_PASSWORD) وليس موظفاً في قاعدة البيانات — تُغيَّر كلمة مروره من إعدادات الخادم.",
    };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) {
    return { ok: false, error: "أدخل كلمة المرور الحالية والجديدة." };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `كلمة المرور الجديدة ${MIN_PASSWORD_LENGTH} أحرف على الأقل.` };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: "تأكيد كلمة المرور لا يطابق الكلمة الجديدة." };
  }
  if (newPassword === currentPassword) {
    return { ok: false, error: "كلمة المرور الجديدة مطابقة للحالية — اختر كلمة مختلفة." };
  }

  const employee = await prisma.adminEmployee.findUnique({
    where: { id: employeeId },
    select: { passwordHash: true, isActive: true },
  });
  if (!employee || !employee.isActive) {
    return { ok: false, error: "الحساب غير موجود أو معطّل." };
  }

  if (!(await verifyPassword(currentPassword, employee.passwordHash))) {
    return { ok: false, error: "كلمة المرور الحالية غير صحيحة." };
  }

  try {
    await prisma.adminEmployee.update({
      where: { id: employeeId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذّر حفظ كلمة المرور. تحقق من الاتصال بقاعدة البيانات." };
  }

  return { ok: true };
}
