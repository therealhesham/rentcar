import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getAdminSession } from "@/lib/admin-auth";
import { getUnderConstructionSettings } from "@/lib/site-settings";
import { UnderConstructionForm } from "./UnderConstructionForm";

export const dynamic = "force-dynamic";

export default async function AdminUnderConstructionPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  if (!session.isSuperAdmin) {
    redirect("/admin");
  }

  const settings = await getUnderConstructionSettings();

  return (
    <>
      <AdminPageHeader
        title="وضع قيد الإنشاء"
        description="يحجب الموقع العام عن الزوار ومحركات البحث (مناسب لموقع الاختبار). لوحة التحكم لا تتأثر."
        backHref="/admin"
        backLabel="لوحة التحكم"
      />

      <UnderConstructionForm
        key={`${settings.enabled}-${settings.message}`}
        enabled={settings.enabled}
        message={settings.message}
      />
    </>
  );
}
