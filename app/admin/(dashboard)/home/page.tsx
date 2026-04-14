import { redirect } from "next/navigation";
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
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">الصفحة الرئيسية — الهيرو</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          تعديل صورة الخلفية الكبيرة في أعلى الموقع ووصفها (نص بديل).
        </p>
      </header>

      <HomeHeroEditForm currentImageUrl={hero.imageUrl} currentAlt={hero.imageAlt} />
    </>
  );
}
