import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getBookingWidgetTabFlags } from "@/lib/site-settings";
import { BookingWidgetTabsForm } from "./BookingWidgetTabsForm";

export const dynamic = "force-dynamic";

export default async function AdminBookingWidgetTabsPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const flags = await getBookingWidgetTabFlags();

  return (
    <>
      <AdminPageHeader
        title="تبويبات ويدجت الحجز"
        description={
          <>
            اختر ما يظهر للزائر في نموذج البحث (الرئيسية وصفحة الأسطول). التبويبات غير المفعّلة{" "}
            <span className="font-bold text-on-surface">لا تُعرض</span> — دون إشعار مزعج للعميل.
          </>
        }
        backHref="/admin"
      />

      <BookingWidgetTabsForm key={JSON.stringify(flags)} flags={flags} />
    </>
  );
}
