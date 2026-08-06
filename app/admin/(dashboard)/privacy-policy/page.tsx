import { requireAdminPage } from "@/lib/admin-page";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getPrivacyPolicyContent } from "@/lib/site-settings";
import { PrivacyPolicyForm } from "./PrivacyPolicyForm";

export const dynamic = "force-dynamic";

export default async function AdminPrivacyPolicyPage() {
  // الوصول محكوم بصلاحية `/admin/privacy-policy` في middleware — بلا قفل سوبر أدمن إضافي.
  await requireAdminPage();

  const content = await getPrivacyPolicyContent();

  return (
    <>
      <AdminPageHeader
        title="سياسة الخصوصية"
        description="النص الذي يظهر لزوار الموقع في صفحة «سياسة الخصوصية» المرتبطة من الفوتر. اكتبه بالعربية، والإنجليزية اختيارية."
        backHref="/admin"
      />

      <PrivacyPolicyForm bodyAr={content.ar} bodyEn={content.en} />
    </>
  );
}
