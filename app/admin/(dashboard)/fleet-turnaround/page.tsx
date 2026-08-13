import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import {
  DEFAULT_FLEET_TURNAROUND_MINUTES,
  getFleetTurnaroundMinutes,
} from "@/lib/site-settings";
import { FleetTurnaroundForm } from "./FleetTurnaroundForm";

export const dynamic = "force-dynamic";

export default async function AdminFleetTurnaroundPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const currentMinutes = await getFleetTurnaroundMinutes();

  return (
    <>
      <AdminPageHeader
        title="فترة التجهيز بين الحجوزات"
        description={
          <>
            المدة التي تحتاجها المركبة بعد رجوعها من عميل قبل تسليمها لعميل آخر — الفحص والنظافة
            والتزود بالوقود وإنهاء الأوراق. خلالها لا تظهر المركبة متاحة في نتائج البحث ولا يمكن
            حجزها.
            <br />
            <span className="mt-2 block font-semibold">
              مثال بفترة تجهيز ساعتين: مركبة موعد إرجاعها ٢:٠٠م لا تُتاح لحجز جديد إلا من ٤:٠٠م.
            </span>
          </>
        }
        backHref="/admin"
      />

      <FleetTurnaroundForm
        key={currentMinutes}
        currentMinutes={currentMinutes}
        defaultMinutes={DEFAULT_FLEET_TURNAROUND_MINUTES}
      />
    </>
  );
}
