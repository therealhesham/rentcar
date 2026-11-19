import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getPromoModalSettings } from "@/lib/site-settings";
import { PromoModalEditForm } from "./PromoModalEditForm";
import type { PromoModalCarOption } from "./PromoModalSlideFields";

export const dynamic = "force-dynamic";

export default async function AdminPromoModalPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const [settings, carModels] = await Promise.all([
    getPromoModalSettings(),
    prisma.carModel.findMany({
      select: { id: true, name: true, year: true, brand: { select: { name: true } } },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }, { year: "desc" }],
    }),
  ]);

  const cars: PromoModalCarOption[] = carModels.map((m) => ({
    id: m.id,
    brand: m.brand.name,
    label: `${m.brand.name} ${m.name} ${m.year}`,
  }));

  return (
    <>
      <AdminPageHeader
        title="النافذة الترويجية (Popup)"
        description="نافذة تفتح تلقائياً عند دخول الصفحة الرئيسية. تظهر صورة واحدة في كل مرة، وفي الزيارة التالية بعد انتهاء فترة التهدئة تظهر الصورة التي تليها بالتناوب."
        backHref="/admin"
      />

      <PromoModalEditForm settings={settings} cars={cars} />
    </>
  );
}
