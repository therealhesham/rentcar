import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getAdminSession } from "@/lib/admin-auth";
import { getPromoBadgeSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { PromoBadgeForm, type PromoBadgeModelOption } from "./PromoBadgeForm";

export const dynamic = "force-dynamic";

export default async function AdminPromoBadgePage() {
  // صفحة سوبر أدمن فقط — نفس نمط /admin/kyc-doc-requirements (طبقة فحص ثانية لا تتّكئ على middleware وحده).
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?next=/admin/promo-badge");
  if (!session.isSuperAdmin) redirect("/admin");

  const [settings, modelsRaw] = await Promise.all([
    getPromoBadgeSettings(),
    prisma.carModel.findMany({
      select: {
        id: true,
        name: true,
        year: true,
        price: true,
        createdAt: true,
        updatedAt: true,
        brand: { select: { name: true } },
      },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }, { year: "desc" }],
    }),
  ]);

  const models: PromoBadgeModelOption[] = modelsRaw.map((m) => ({
    id: m.id,
    label: `${m.brand.name} ${m.name} ${m.year}`,
    priceLabel: `${m.price} ر.س/يوم`,
    createdAtIso: m.createdAt.toISOString(),
    updatedAtIso: m.updatedAt.toISOString(),
  }));

  return (
    <>
      <AdminPageHeader
        title="شارة ترويجية على كارت السيارة"
        description={
          <>
            شارة نصية بلون خلفية تختاره، تظهر بدل شارة «وفّرت/خصم» المعتادة على الموديلات
            اللي تختارها فقط. عطّل التفعيل وترجع كل الموديلات لشارتها الافتراضية تلقائياً.
          </>
        }
        backHref="/admin"
      />

      <PromoBadgeForm key={JSON.stringify(settings)} settings={settings} models={models} />
    </>
  );
}
