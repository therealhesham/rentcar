import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getMobileAudience } from "@/app/admin/mobile-offers-actions";
import { MobileOfferForm } from "./MobileOfferForm";

export const dynamic = "force-dynamic";

export default async function AdminMobileOffersPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const audience = await getMobileAudience();

  return (
    <>
      <AdminPageHeader
        title="عروض الجوال"
        description="إرسال إشعار مباشر لأجهزة عملاء تطبيق الجوال. يصل فوراً ولا يحتاج تحديث التطبيق، والعملاء الذين أغلقوا القناة من إعدادات التطبيق يُستبعدون تلقائياً."
      />

      <MobileOfferForm audience={audience} />
    </>
  );
}
