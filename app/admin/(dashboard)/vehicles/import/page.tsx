import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { VehicleImportClient } from "./VehicleImportClient";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function VehicleImportPage() {
  const session = await requireAdminPage();
  if (!session.isSuperAdmin) redirect("/admin/vehicles");

  const [categories, branches] = await Promise.all([
    prisma.fleetCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, title: true },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (categories.length === 0) {
    return (
      <>
        <AdminPageHeader
          title="استيراد مركبات من Excel"
          backHref="/admin/vehicles"
          backLabel="المركبات والأسطول"
        />
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 p-6">
          <p className="font-bold text-amber-950">لا توجد فئات في قاعدة البيانات.</p>
          <p className="mt-2 text-sm text-amber-900">
            أضف فئة واحدة على الأقل من{" "}
            <a href="/admin/categories" className="font-bold text-primary underline underline-offset-2">
              إدارة الفئات
            </a>{" "}
            قبل الاستيراد.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="استيراد مركبات من Excel"
        backHref="/admin/vehicles"
        backLabel="المركبات والأسطول"
        description={
          <>
            ارفع ملف <span className="font-bold text-on-surface">xlsx / csv</span> ثم حدد
            أي عمود يقابل كل حقل. فئة الأسطول والفرع اختياريان — الافتراضي لا يغيّر الفئة ولا
            يسجّل كميات. الماركة تُنشأ تلقائياً، والموديل المكرر يُحدَّث دون تكرار.
          </>
        }
      />

      <VehicleImportClient categories={categories} branches={branches} />
    </>
  );
}
