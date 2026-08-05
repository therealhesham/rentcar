import Link from "next/link";
import { Share2 } from "lucide-react";
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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 text-sm text-on-surface">
        <div className="flex items-center gap-3">
          <Share2 className="size-5 text-primary" aria-hidden />
          <div>
            <span className="font-bold">روابط التواصل الاجتماعي في الفوتر: </span>
            <span className="text-on-surface-variant">
              يمكنك أيضاً تخصيص وتفعيل روابط الانستقرام، تيك توك، سناب شات، واتساب وغيرها.
            </span>
          </div>
        </div>
        <Link
          href="/admin/social-links"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition-opacity hover:opacity-90"
        >
          إدارة روابط السوشيال ميديا
        </Link>
      </div>

      <SiteBrandingEditForm current={branding} />
    </>
  );
}
