import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AvailabilityImportClient } from "./AvailabilityImportClient";
import { requireAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AvailabilityImportPage() {
  // الوصول محكوم بصلاحية `/admin/fleet-availability/import` المستقلة في middleware — مش
  // وراثة من `/admin/fleet-availability`، عشان صلاحية عرض التوفر متديش تعديله بالغلط.
  await requireAdminPage();

  return (
    <>
      <AdminPageHeader
        title="تحديث الاتاحة"
        backHref="/admin/fleet-availability"
        backLabel="توفر المركبات"
        description={
          <>
            رفع ملف Excel لحجب إتاحة عربيات (صيانة/تأجير خارجي) — <span className="font-bold text-on-surface">موديل + فرع
            + تاريخ ووقت الاستلام والإرجاع</span>. الحجب يُحسب بنفس منطق التوفر الذي يراه العميل
            بالضبط، فيختفي فوراً من نتائج البحث لنفس الفترة، ويعود متاحاً تلقائياً بعد موعد
            الإرجاع مباشرة. إعادة رفع نفس الصف (نفس العربية والفرع والتوقيت) تُتجاهل ولا تُنشئ
            حجباً مكرراً. لو الحجب لتأجير خارجي بعميل حقيقي، اربط عمودي{" "}
            <span className="font-bold text-on-surface">اسم العميل وجواله</span> معاً — هيُنشأ
            أو يُربط حساب عميل حقيقي بنفس بياناته بدل حجب مجهول.
          </>
        }
      />
      <AvailabilityImportClient />
    </>
  );
}
