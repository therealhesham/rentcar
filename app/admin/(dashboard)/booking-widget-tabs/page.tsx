import { redirect } from "next/navigation";
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
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">تبويبات ويدجت الحجز</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          اختر ما يظهر للزائر في نموذج البحث (الرئيسية وصفحة الأسطول). التبويبات غير المفعّلة{" "}
          <span className="font-bold text-on-surface">لا تُعرض</span> — دون إشعار مزعج للعميل.
        </p>
      </header>

      <BookingWidgetTabsForm key={JSON.stringify(flags)} flags={flags} />
    </>
  );
}
