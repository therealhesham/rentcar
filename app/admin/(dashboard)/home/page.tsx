import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getHomeHeroSettings } from "@/lib/site-settings";
import { HomeHeroEditForm } from "./HomeHeroEditForm";

export const dynamic = "force-dynamic";

export default async function AdminHomeHeroPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const hero = await getHomeHeroSettings();

  return (
    <>
      <AdminPageHeader
        title="الصفحة الرئيسية — الهيرو"
        description="تعديل صورة خلفية الهيرو الكاملة والنص البديل لها."
        backHref="/admin"
      />

      <HomeHeroEditForm
        currentImageUrl={hero.imageUrl}
        currentImageAlt={hero.imageAlt}
      />
    </>
  );
}
