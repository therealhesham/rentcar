import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { TestGeideaRefundForm } from "@/components/admin/TestGeideaRefundForm";
import { requireAdminPage } from "@/lib/admin-page";
import {
  fetchGeideaOrderByMerchantReference,
  isGeideaConfigured,
} from "@/lib/geidea/client";
import { startGeideaTestPaymentAction } from "@/app/admin/test-geidea-actions";
import { TEST_GEIDEA_REF_COOKIE } from "@/lib/test-geidea-constants";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

function StatusPill({ paid }: { paid: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-black ${
        paid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {paid ? "مدفوع" : "غير مدفوع بعد"}
    </span>
  );
}

export default async function AdminTestGeideaPage({ searchParams }: Props) {
  const session = await requireAdminPage();
  if (!session.isSuperAdmin) redirect("/admin");

  const sp = await searchParams;
  const configured = isGeideaConfigured();

  const jar = await cookies();
  const ref = jar.get(TEST_GEIDEA_REF_COOKIE)?.value ?? null;

  let order: Awaited<ReturnType<typeof fetchGeideaOrderByMerchantReference>> | null = null;
  let lookupError: string | null = null;
  if (ref && configured) {
    try {
      order = await fetchGeideaOrderByMerchantReference(ref);
    } catch (e) {
      lookupError = e instanceof Error ? e.message : "فشل البحث عن الطلب.";
    }
  }

  const isPaid =
    order != null &&
    order.detailedStatus.trim().toLowerCase() === "paid" &&
    order.currency.trim().toUpperCase() === "SAR";

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="اختبار بوابة جيديا"
        description="أداة داخلية لسوبر أدمن فقط — تنفّذ عملية دفع حقيقية بمبلغ 1 ر.س على بيئة الإنتاج الفعلية ثم تسمح باسترداده، دون أي علاقة بحجوزات العملاء الحقيقية."
      />

      <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
        ⚠️ هذه الصفحة تستخدم مفاتيح جيديا الحقيقية (إنتاج) وتحرّك مبلغاً فعلياً — استخدمها فقط
        للتحقق من أن الربط يعمل، وتأكد من تنفيذ الاسترداد بعد كل اختبار.
      </div>

      {sp.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">❌ حدث خطأ أثناء عملية الدفع:</p>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-red-100 p-3 font-mono text-xs dir-ltr">
            {sp.error}
          </pre>
        </div>
      ) : null}

      <AdminCard title="حالة الإعداد واللوجات الحية">
        <div className="space-y-3">
          {configured ? (
            <p className="text-sm font-bold text-emerald-700">
              ✅ بوابة جيديا مهيّأة — مفاتيح البيئة موجودة ومفعلة.
            </p>
          ) : (
            <p className="text-sm font-bold text-red-700">
              ❌ بوابة جيديا غير مهيّأة — أضف GEIDEA_PUBLIC_KEY و GEIDEA_API_PASSWORD في متغيرات البيئة.
            </p>
          )}

          <div className="rounded-xl bg-surface-container p-4 text-xs space-y-2 font-mono dir-ltr">
            <p className="font-sans font-bold text-on-surface text-sm mb-2">📋 متغيرات البيئة الحالية (Diagnostics):</p>
            <p>GEIDEA_PUBLIC_KEY: {process.env.GEIDEA_PUBLIC_KEY ? `✅ (Length: ${process.env.GEIDEA_PUBLIC_KEY.trim().length}, Prefix: ${process.env.GEIDEA_PUBLIC_KEY.trim().slice(0, 6)}...)` : "❌ غير مضبوط"}</p>
            <p>GEIDEA_API_PASSWORD: {process.env.GEIDEA_API_PASSWORD ? `✅ (Length: ${process.env.GEIDEA_API_PASSWORD.trim().length})` : "❌ غير مضبوط"}</p>
            <p>GEIDEA_API_BASE: {process.env.GEIDEA_API_BASE?.trim() || "https://api.ksamerchant.geidea.net (الافتراضي - KSA)"}</p>
            <p>GEIDEA_HPP_BASE: {process.env.GEIDEA_HPP_BASE?.trim() || "https://www.ksamerchant.geidea.net (الافتراضي - KSA)"}</p>
            <p>APP_PUBLIC_URL: {process.env.APP_PUBLIC_URL?.trim() || "⚠️ غير محدد (قد يؤثر على التوجيه والـ Webhook)"}</p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 space-y-1 font-sans">
            <p className="font-bold">💡 تلميح التشخيص والدعم:</p>
            <p>تم إضافة لوجات مفصلة في خادم التطبيق (`console.log`). يتم تسجيل كل طلبات `Geidea Client` والـ Payloads والردود بـ HTTP Status في لوجات الخادم (Terminal Logs).</p>
            <p className="font-mono bg-blue-100 p-2 rounded mt-2 dir-ltr">node scripts/geidea-diagnose.mjs</p>
            <p className="text-[11px] text-blue-700">يمكنك أيضاً تشغيل الأمر أعلاه مباشرة في السيرفر لفحص الاتصال والتوقيع بجميع المفاتيح طازجة وطباعة الرد الكامل من جيديا.</p>
          </div>
        </div>
      </AdminCard>

      <AdminCard
        title="١) دفعة اختبار بقيمة ١ ر.س"
        description="ستُفتح صفحة الدفع المستضافة لدى جيديا (HPP) في نفس التبويب — أكمل الدفع بأي وسيلة، وستعود تلقائياً لهذه الصفحة."
      >
        <form action={startGeideaTestPaymentAction}>
          <button
            type="submit"
            disabled={!configured}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-on-primary transition-opacity hover:opacity-95 disabled:opacity-50"
          >
            ابدأ دفعة اختبار (١ ر.س)
          </button>
        </form>
      </AdminCard>

      <AdminCard
        title="٢) نتيجة آخر دفعة اختبار"
        description="تُقرأ حالة الطلب مباشرةً من جيديا (وليس من إشعار محلي)."
      >
        {!ref ? (
          <p className="text-sm font-medium text-on-surface-variant">
            لا توجد دفعة اختبار بعد — ابدأ واحدة من الأعلى.
          </p>
        ) : lookupError ? (
          <p className="text-sm font-bold text-red-700">تعذّر البحث عن الطلب: {lookupError}</p>
        ) : !order ? (
          <div className="space-y-2">
            <p className="text-sm font-bold text-amber-700">
              لم يُعثر على الطلب بعد — قد يستغرق ثوانٍ بعد إتمام الدفع فعلياً.
            </p>
            <a
              href="/admin/test-geidea"
              className="inline-block rounded-lg border border-outline-variant px-4 py-2 text-xs font-bold text-primary hover:bg-surface-container"
            >
              تحديث الصفحة
            </a>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="font-bold text-on-surface-variant">رقم الطلب (orderId): </span>
                <span dir="ltr" className="font-mono">{order.orderId}</span>
              </p>
              <p>
                <span className="font-bold text-on-surface-variant">الحالة: </span>
                <StatusPill paid={isPaid} /> ({order.detailedStatus || order.status})
              </p>
              <p>
                <span className="font-bold text-on-surface-variant">المبلغ: </span>
                {order.amount} {order.currency}
              </p>
              <p>
                <span className="font-bold text-on-surface-variant">وسيلة الدفع: </span>
                {order.paymentBrand ?? "—"}
              </p>
            </div>

            {isPaid ? (
              <TestGeideaRefundForm orderId={order.orderId} amountSar={order.amount} />
            ) : (
              <p className="text-xs font-bold text-on-surface-variant">
                الاسترداد يظهر فقط بعد تأكيد الدفع.
              </p>
            )}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
