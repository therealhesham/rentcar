import { redirect } from "next/navigation";
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
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">البانر الترويجي (Carousel)</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          أضف حتى 5 صور تظهر فوق قسم «خدماتنا» كـ carousel تلقائي.
          كل شريحة يمكن ربطها برابط عند النقر عليها.
        </p>
      </header>

      <PromoBannerEditForm currentSlides={slides} />
    </>
  );
}
