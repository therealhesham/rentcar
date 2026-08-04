import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getPromoBannerSlides } from "@/lib/site-settings";
import { PromoBannerEditForm } from "./PromoBannerEditForm";

export const dynamic = "force-dynamic";

export default async function AdminPromoBannerPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const slides = await getPromoBannerSlides();

  return (
    <>
      <AdminPageHeader
        title="البانر الترويجي (Carousel)"
        description="أضف حتى 5 صور تظهر فوق قسم «خدماتنا» كـ carousel تلقائي. كل شريحة يمكن ربطها برابط عند النقر عليها."
        backHref="/admin"
      />

      <PromoBannerEditForm currentSlides={slides} />
    </>
  );
}
