import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getAdminSession } from "@/lib/admin-auth";
import { getPromoBadgeSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { PromoBadgeCampaignsManager } from "./PromoBadgeCampaignsManager";
import type { PromoBadgeModelOption } from "./PromoBadgeCampaignCard";

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
            عروض مستقلة — كل عرض بنصه وألوانه وموديلاته الخاصة، وتقدر تشغّل أكتر من عرض في
            نفس الوقت. عرض معطَّل أو موديل مش مختار فيه يرجع لشارة «وفّرت/خصم» المعتادة
            تلقائياً.
          </>
        }
        backHref="/admin"
      />

      <PromoBadgeCampaignsManager key={JSON.stringify(settings)} campaigns={settings.campaigns} models={models} />
    </>
  );
}
