import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { TestGeideaRefundForm } from "@/components/admin/TestGeideaRefundForm";
import { requireAdminPage } from "@/lib/admin-page";
import { TestGeideaApplePay } from "@/components/admin/TestGeideaApplePay";
import {
  fetchGeideaOrderByMerchantReference,
  geideaCheckoutScriptUrl,
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
  const scriptUrl = geideaCheckoutScriptUrl();

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
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{sp.error}</p>
      ) : null}

      <AdminCard title="حالة الإعداد">
        {configured ? (
          <p className="text-sm font-bold text-emerald-700">
            بوابة جيديا مهيّأة — مفاتيح البيئة موجودة (GEIDEA_PUBLIC_KEY / GEIDEA_API_PASSWORD).
          </p>
        ) : (
          <p className="text-sm font-bold text-red-700">
            بوابة جيديا غير مهيّأة — أضف GEIDEA_PUBLIC_KEY و GEIDEA_API_PASSWORD في متغيرات البيئة.
          </p>
        )}
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
        title="١‏.ب) اختبار Apple Pay السريع (١ ر.س)"
        description="الزر يُعرض هنا مباشرةً (Express Checkout) بلا تحويل إلى صفحة جيديا — يظهر فقط على Safari في جهاز Apple مع بطاقة مُضافة. يتطلب توثيق النطاق وتفعيل Apple Pay for Web لدى جيديا."
      >
        {configured && scriptUrl ? (
          <TestGeideaApplePay scriptUrl={scriptUrl} />
        ) : (
          <p className="text-sm font-bold text-red-700">
            بوابة جيديا غير مهيّأة — لا يمكن تهيئة Apple Pay.
          </p>
        )}
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
