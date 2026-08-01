import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { FleetQuantityImportClient } from "./FleetQuantityImportClient";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FleetQuantitiesImportPage() {
  const session = await requireAdminPage();
  const lockedBranchId = session.isSuperAdmin ? null : session.branchId ?? null;

  // موظف إدارة مركزية (لا سوبر أدمن ولا مرتبط بفرع): الكميات مملوكة للفروع، وكل إجراء
  // هنا سيرفضه الخادم — نوضّح ذلك بدل عرض أدوات لا تعمل.
  if (!session.isSuperAdmin && lockedBranchId == null) {
    return (
      <>
        <AdminPageHeader
          title="تحديث عدد السيارات من Excel"
          backHref="/admin/vehicles"
          backLabel="السيارات والأسطول"
        />
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 p-6">
          <p className="font-bold text-amber-950">حسابك غير مرتبط بفرع.</p>
          <p className="mt-2 text-sm text-amber-900">
            كميات السيارات تُدار لكل فرع على حدة، فيحتاج الحساب ارتباطاً بفرع لتحديثها.
            راجع مدير النظام لربط حسابك بفرع، أو اطلب منه تنفيذ التحديث.
          </p>
        </div>
      </>
    );
  }

  const branches = await prisma.branch.findMany({
    where: {
      isActive: true,
      ...(lockedBranchId != null && { id: lockedBranchId }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <>
      <AdminPageHeader
        title="تحديث عدد السيارات من Excel"
        backHref="/admin/vehicles"
        backLabel="السيارات والأسطول"
        description={
          <>
            نزّل قالب الكميات الحالية، عدّل عمود الكمية، ثم ارفعه. يُحدَّث{" "}
            <span className="font-bold text-on-surface">عدد السيارات فقط</span> — بلا مساس
            بالأسعار أو المواصفات، وأي فرع أو موديل غير مذكور في الملف يبقى كما هو.
          </>
        }
      />

      <FleetQuantityImportClient branches={branches} lockedBranchId={lockedBranchId} />
    </>
  );
}
