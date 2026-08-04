import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getSiteBranding } from "@/lib/site-settings";
import { SiteBrandingEditForm } from "./SiteBrandingEditForm";

export const dynamic = "force-dynamic";

export default async function AdminSiteBrandingPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const branding = await getSiteBranding();

  return (
    <>
      <AdminPageHeader
        title="شعارات الموقع"
        description="شعار الهيدر والفوتر بنسخة عربية وأخرى إنجليزية، بالإضافة إلى أيقونة المتصفح وصورة المشاركة."
        backHref="/admin"
      />

      <SiteBrandingEditForm current={branding} />
    </>
  );
}
