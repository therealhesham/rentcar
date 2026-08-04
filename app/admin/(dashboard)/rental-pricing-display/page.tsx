import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getRentalPriceDisplayMode } from "@/lib/site-settings";
import { RentalPricingDisplayForm } from "./RentalPricingDisplayForm";

export const dynamic = "force-dynamic";

export default async function AdminRentalPricingDisplayPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const currentMode = await getRentalPriceDisplayMode();

  return (
    <>
      <AdminPageHeader
        title="عرض أسعار التأجير للعملاء"
        description="يتحكم هذا الخيار في طريقة ظهور السعر اليومي في بطاقات صفحة الأسطول وفي ملخص السعر المرجعي بصفحة إتمام الحجز. أسعار الموديلات في قاعدة البيانات تبقى دائماً دون ضريبة؛ يتغيّر العرض فقط."
        backHref="/admin"
      />

      <RentalPricingDisplayForm key={currentMode} currentMode={currentMode} />
    </>
  );
}
