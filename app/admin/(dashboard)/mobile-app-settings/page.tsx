import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS,
  MOBILE_KEY_PAYMENT_METHODS,
  normalizeMobileAppPaymentMethodFlags,
} from "@/lib/mobile-app-payment-flags";
import { MobileAppPaymentMethodsForm } from "./MobileAppPaymentMethodsForm";

export const dynamic = "force-dynamic";

async function getMobileAppPaymentFlags() {
  try {
    const row = await prisma.mobileAppSetting.findUnique({
      where: { key: MOBILE_KEY_PAYMENT_METHODS },
      select: { value: true },
    });
    if (!row?.value?.trim()) return DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS;
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value) as unknown;
    } catch {
      return DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS;
    }
    return normalizeMobileAppPaymentMethodFlags(parsed);
  } catch {
    return DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS;
  }
}

export default async function MobileAppSettingsPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const flags = await getMobileAppPaymentFlags();

  return (
    <>
      <AdminPageHeader
        title="إعدادات تطبيق الموبايل"
        description="تحكم في طرق الدفع الظاهرة للعميل في تطبيق روائس — مستقل تماماً عن طرق دفع الموقع."
        backHref="/admin"
        backLabel="لوحة التحكم"
      />

      <div className="mb-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant">
        <span className="font-bold text-on-surface">ملاحظة: </span>
        هذه الإعدادات تنعكس على تطبيق روائس (Expo/React Native) فقط عبر جدول{" "}
        <span className="font-mono text-[11px]" dir="ltr">
          MobileAppSetting
        </span>{" "}
        المشترك في قاعدة البيانات — لا تأثير على صفحة دفع الموقع.
      </div>

      <MobileAppPaymentMethodsForm
        key={JSON.stringify(flags)}
        flags={flags}
      />
    </>
  );
}
