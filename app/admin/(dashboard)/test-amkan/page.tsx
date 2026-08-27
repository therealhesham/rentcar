import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { TestAmkanPanel } from "@/components/admin/TestAmkanPanel";
import { requireAdminPage } from "@/lib/admin-page";
import { getAmkanCredentials, isAmkanConfigured } from "@/lib/amkan/client";

export const dynamic = "force-dynamic";

export default async function AdminTestAmkanPage() {
  // الوصول محكوم بصلاحية `/admin/test-amkan` في middleware.
  await requireAdminPage();

  const creds = getAmkanCredentials();
  const fullyConfigured = isAmkanConfigured();

  return (
    <div>
      <AdminPageHeader
        title="أداة اختبار بوابة إمكان"
        backHref="/admin"
        description="اختبار الساندبوكس دون المساس بأي حجز حقيقي — كل طلب هنا يُنشأ بمرجع لا يطابق أي حجز."
      />

      {!fullyConfigured ? (
        <AdminCard className="mb-6">
          <p className="text-sm font-bold leading-relaxed text-on-surface" dir="auto">
            إمكان ليست مهيّأة بالكامل بعد، وهذا متوقّع: <code>getAmkanConfig</code> يشترط ستة
            متغيّرات. استخدم الحقول أدناه لتجريب القيم الناقصة، ثم ثبّتها في <code>.env</code>.
          </p>
          <p className="mt-2 text-sm text-on-surface-variant" dir="auto">
            ما دامت غير مهيّأة، تبقى إمكان مرفوضة صراحةً في صفحة دفع العميل — لا يمكن أن يمرّ
            حجز عبرها بالخطأ.
          </p>
        </AdminCard>
      ) : null}

      <TestAmkanPanel
        env={{
          hasCredentials: creds != null,
          merchantId: process.env.AMKAN_MERCHANT_ID?.trim() ?? "",
          apiBase: process.env.AMKAN_API_BASE?.trim() ?? "",
          merchantCode: process.env.AMKAN_MERCHANT_CODE?.trim() ?? "",
          originSourceChannel: process.env.AMKAN_ORIGIN_SOURCE_CHANNEL?.trim() ?? "",
        }}
      />
    </div>
  );
}
