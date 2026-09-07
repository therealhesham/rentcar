import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getPromoModalSettings } from "@/lib/site-settings";
import { PromoModalEditForm } from "./PromoModalEditForm";

export const dynamic = "force-dynamic";

export default async function AdminPromoModalPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const settings = await getPromoModalSettings();

  return (
    <>
      <AdminPageHeader
        title="النافذة الترويجية (Popup)"
        description="نافذة تفتح تلقائياً عند دخول الصفحة الرئيسية. تظهر صورة واحدة في كل مرة، وفي الزيارة التالية بعد انتهاء فترة التهدئة تظهر الصورة التي تليها بالتناوب."
        backHref="/admin"
      />

      <PromoModalEditForm settings={settings} />
    </>
  );
}
