import "server-only";
import { headers } from "next/headers";
import type { AdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/**
 * تسجيل فتح صفحة داخل لوحة التحكم — مصدر قسم «الموظفون الأكثر فتحاً» وحده.
 * لا يرمي أخطاء أبداً: فشل القياس يجب ألا يُظهر خطأ لموظف يتصفّح ولا يوقف التنقّل.
 */
export async function recordAdminPageView(
  session: AdminSession,
  rawPath: string,
): Promise<void> {
  const path = rawPath.slice(0, 512);
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip =
      (forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "").slice(0, 64) || null;

    await prisma.adminPageView.create({
      data: {
        employeeId: session.employeeId,
        employeeLabel: session.displayName?.slice(0, 255) || null,
        isSuperAdmin: session.isSuperAdmin,
        path,
        ip,
        userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
      },
    });
  } catch (e) {
    console.error("insights: failed to record admin page view", e);
  }
}

/**
 * هل المسار جدير بالتسجيل؟ نقيس صفحات لوحة التحكم فقط — لا واجهات API ولا صفحة
 * الدخول (لا جلسة فيها أصلاً) ولا ملفات ثابتة تسرّبت من الـ router.
 */
export function isTrackableAdminPath(path: string): boolean {
  if (!path.startsWith("/admin")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/admin/login")) return false;
  if (path.length > 512) return false;
  return true;
}
