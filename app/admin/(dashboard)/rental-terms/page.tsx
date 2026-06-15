import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  CreateTermForm,
  RentalTermsTable,
  type TermRow,
} from "@/components/admin/RentalTermsClient";

export const dynamic = "force-dynamic";

export default async function RentalTermsPage() {
  const session = await requireAdminPage();

  // Super admin only — branch employees don't manage global terms
  if (!session.isSuperAdmin) {
    return (
      <div className="py-12 text-center text-sm font-bold text-on-surface-variant">
        هذه الصفحة متاحة لمدير النظام فقط.
      </div>
    );
  }

  const terms = await prisma.rentalTerm.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  const rows: TermRow[] = terms.map((t) => ({
    id: t.id,
    titleAr: t.titleAr,
    titleEn: t.titleEn,
    bodyAr: t.bodyAr,
    bodyEn: t.bodyEn,
    sortOrder: t.sortOrder,
    isActive: t.isActive,
  }));

  return (
    <>
      <AdminPageHeader
        title="الشروط والأحكام"
        description="أضف وعدّل بنود الشروط والأحكام التي تظهر للعميل أثناء عملية الحجز. يمكنك إضافة نص بالعربية والإنجليزية لكل بند."
        backHref="/admin"
      />

      <AdminCard className="mb-6" title="إجمالي البنود">
        <p className="text-sm text-on-surface-variant">
          {rows.length} بند ({rows.filter((r) => r.isActive).length} مفعّل)
        </p>
      </AdminCard>

      <div className="space-y-6">
        <CreateTermForm />
        <RentalTermsTable terms={rows} />
      </div>
    </>
  );
}
