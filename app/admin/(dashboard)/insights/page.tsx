import { redirect } from "next/navigation";
import { InsightsBreakdown } from "@/components/admin/insights/InsightsBreakdown";
import { InsightsEmployeesTable } from "@/components/admin/insights/InsightsEmployeesTable";
import {
  InsightsExitPagesTable,
  InsightsTopPagesTable,
} from "@/components/admin/insights/InsightsPagesTable";
import { InsightsPeakHours } from "@/components/admin/insights/InsightsPeakHours";
import { InsightsRangeTabs } from "@/components/admin/insights/InsightsRangeTabs";
import {
  InsightsEmpty,
  InsightsSection,
  InsightsStat,
} from "@/components/admin/insights/InsightsShell";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getEmployeeUsage,
  getVisitorInsights,
  parseInsightsRange,
} from "@/lib/insights/insights-queries";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ days?: string }> };

export default async function AdminInsightsPage({ searchParams }: Props) {
  // الصفحة غير مسجّلة في ADMIN_PAGE_PERMISSIONS عن قصد: `resolveAdminPagePermissionId`
  // يعيد null لها، وmiddleware يعامل ذلك كمنع افتراضي — فلا يمكن منحها لموظف أصلاً.
  // هذا الفحص هو الطبقة الثانية: صفحة بهذه الحساسية لا تُترك متكئة على حارس واحد
  // في ملف آخر.
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?next=/admin/insights");
  if (!session.isSuperAdmin) redirect("/admin");

  const sp = await searchParams;
  const days = parseInsightsRange(sp.days);

  const [visitors, employees] = await Promise.all([
    getVisitorInsights(days),
    getEmployeeUsage(days),
  ]);

  return (
    <div className="pb-12">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1c1b1b] sm:text-3xl">
          إحصائيات
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant sm:text-[15px]">
          سلوك العملاء على الموقع: من أي أجهزة يدخلون، في أي أوقات، وأي الصفحات يزورونها
          أكثر — وأيها تتوقّف عندها الزيارة. صفحة خاصة بمدير النظام.
        </p>
      </header>

      <div className="mb-6">
        <InsightsRangeTabs days={days} />
      </div>

      {visitors.truncated ? (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          حجم السجل في هذه الفترة تجاوز الحد المسموح للتحليل، فاقتُصرت الأرقام على الأحدث.
          اختر فترة أقصر لقراءة دقيقة.
        </p>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InsightsStat
          label="زيارات صفحات العملاء"
          value={visitors.totalViews.toLocaleString("ar-EG")}
          hint={`آخر ${days} يوماً`}
        />
        <InsightsStat
          label="عدد الجلسات"
          value={visitors.totalSessions.toLocaleString("ar-EG")}
          hint="فاصل خمول ٣٠ دقيقة"
        />
        <InsightsStat
          label="زوّار مختلفون"
          value={visitors.uniqueVisitors.toLocaleString("ar-EG")}
        />
        <InsightsStat
          label="صفحات لكل جلسة"
          value={visitors.pagesPerSession.toFixed(1)}
          hint="متوسط عمق الزيارة"
        />
      </div>

      <div className="space-y-6">
        {/* القسم الإداري الوحيد — مقصود أن يكون سطراً واحداً في الصفحة لا محورها */}
        <InsightsSection
          title="الموظفون الأكثر فتحاً للنظام"
          description="مرتّبون بعدد فتحات صفحات لوحة التحكم خلال الفترة. هذا القسم وحده عن الموظفين؛ بقية الصفحة عن العملاء."
        >
          <InsightsEmployeesTable rows={employees.rows} />
        </InsightsSection>

        {visitors.isEmpty ? (
          <InsightsSection title="إحصاءات العملاء">
            <InsightsEmpty>
              لا توجد زيارات مسجّلة للموقع خلال هذه الفترة. جرّب فترة أطول.
            </InsightsEmpty>
          </InsightsSection>
        ) : (
          <>
            <InsightsSection
              title="الأجهزة الأكثر استخداماً"
              description="نوع الجهاز ونظامه ومتصفّحه لكل زيارة صفحة سجّلها عميل على الموقع."
            >
              <div className="grid gap-8 md:grid-cols-3">
                <InsightsBreakdown title="نوع الجهاز" rows={visitors.devices} />
                <InsightsBreakdown title="نظام التشغيل" rows={visitors.operatingSystems} />
                <InsightsBreakdown title="المتصفح" rows={visitors.browsers} />
              </div>
            </InsightsSection>

            <InsightsSection
              title="أوقات الذروة للزيارة"
              description="متى يكثر دخول العملاء خلال اليوم والأسبوع — كل الأوقات بتوقيت الرياض."
            >
              <InsightsPeakHours peak={visitors.peak} />
            </InsightsSection>

            <InsightsSection
              title="أكثر الصفحات زيارة"
              description="اضغط «معاينة» لرؤية الصفحة نفسها كنموذج داخل اللوحة، أو «فتح» لفتحها في تبويب جديد."
            >
              {visitors.topPages.length === 0 ? (
                <InsightsEmpty>لا توجد صفحات مسجّلة في هذه الفترة.</InsightsEmpty>
              ) : (
                <InsightsTopPagesTable rows={visitors.topPages} />
              )}
            </InsightsSection>

            <InsightsSection
              title="الصفحات التي تتوقّف عندها الزيارات"
              description="آخر صفحة في الجلسة قبل أن ينسحب العميل. النسبة العالية على صفحة في مسار الحجز تعني تسريباً في المسار لا نهاية طبيعية للزيارة."
            >
              {visitors.exitPages.length === 0 ? (
                <InsightsEmpty>
                  لا توجد جلسات منتهية في هذه الفترة. الجلسات التي ما زالت جارية لا تُحتسب هنا.
                </InsightsEmpty>
              ) : (
                <InsightsExitPagesTable rows={visitors.exitPages} />
              )}
            </InsightsSection>
          </>
        )}
      </div>
    </div>
  );
}
