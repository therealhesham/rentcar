import { redirect } from "next/navigation";
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
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">عرض أسعار التأجير للعملاء</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          يتحكم هذا الخيار في طريقة ظهور السعر اليومي في بطاقات صفحة الأسطول وفي ملخص السعر المرجعي
          بصفحة إتمام الحجز. أسعار الموديلات في قاعدة البيانات تبقى دائماً دون ضريبة؛ يتغيّر العرض
          فقط.
        </p>
      </header>

      <RentalPricingDisplayForm key={currentMode} currentMode={currentMode} />
    </>
  );
}
