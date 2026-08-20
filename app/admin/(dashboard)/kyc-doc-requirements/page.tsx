import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getAdminSession } from "@/lib/admin-auth";
import { getKycDocRequirements } from "@/lib/site-settings";
import { KycDocRequirementsForm } from "./KycDocRequirementsForm";

export const dynamic = "force-dynamic";

export default async function AdminKycDocRequirementsPage() {
  // صفحة سوبر أدمن فقط — غير مسجّلة في ADMIN_PAGE_PERMISSIONS (انظر insights/page.tsx لنفس النمط)،
  // فهذا الفحص طبقة ثانية لا تتّكئ على middleware وحده.
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?next=/admin/kyc-doc-requirements");
  if (!session.isSuperAdmin) redirect("/admin");

  const flags = await getKycDocRequirements();

  return (
    <>
      <AdminPageHeader
        title="مستندات الهوية والرخصة"
        description={
          <>
            تحكّم في حقلَي صورة الهوية/الجواز وصورة رخصة القيادة في نموذج إتمام الحجز: إلزامي، اختياري، أو مخفي
            بالكامل عن العميل.
          </>
        }
        backHref="/admin"
      />

      <KycDocRequirementsForm key={JSON.stringify(flags)} flags={flags} />
    </>
  );
}
