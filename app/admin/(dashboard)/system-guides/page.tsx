import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  SystemGuidesClient,
  type GuideSectionRow,
} from "@/components/admin/SystemGuidesClient";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SystemGuidesPage() {
  // صفحة متاحة لأي موظف مسجّل دخول (alwaysAllowed في القائمة، ومستثناة من فحص middleware).
  // القفل الوحيد هنا هو على الإدارة: الرفع والتعديل والحذف لمدير النظام فقط.
  const session = await requireAdminPage();
  const canManage = session.isSuperAdmin;

  const sections = await prisma.systemGuideSection.findMany({
    where: canManage ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      guides: {
        where: canManage ? undefined : { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });

  const rows: GuideSectionRow[] = sections.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
    guides: s.guides.map((g) => ({
      id: g.id,
      sectionId: g.sectionId,
      title: g.title,
      description: g.description,
      kind: g.kind,
      fileUrl: g.fileUrl,
      originalFileName: g.originalFileName,
      sizeBytes: g.sizeBytes,
      sortOrder: g.sortOrder,
      isActive: g.isActive,
    })),
  }));

  const guidesCount = rows.reduce((sum, s) => sum + s.guides.length, 0);

  return (
    <>
      <AdminPageHeader
        title="شروحات النظام"
        description={
          canManage
            ? "ارفع فيديوهات وصور وملفات PDF تشرح استخدام النظام، ونظّمها في أقسام. الشروحات متاحة للاطلاع لكل الموظفين، والرفع والتعديل لك وحدك كمدير للنظام."
            : "شروحات تشغيل النظام — اختر القسم ثم افتح الشرح الذي تحتاجه."
        }
        backHref="/admin"
      />

      <SystemGuidesClient
        sections={rows}
        canManage={canManage}
        guidesCount={guidesCount}
      />
    </>
  );
}
