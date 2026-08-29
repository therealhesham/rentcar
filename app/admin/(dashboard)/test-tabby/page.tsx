import { cookies } from "next/headers";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { TestTabbyCaptureForm } from "@/components/admin/TestTabbyCaptureForm";
import { TestTabbyRefundForm } from "@/components/admin/TestTabbyRefundForm";
import { requireAdminPage } from "@/lib/admin-page";
import { fetchTabbyPayment, isTabbyConfigured, type TabbyPayment } from "@/lib/tabby/client";
import { startTabbyTestPaymentAction } from "@/app/admin/test-tabby-actions";
import { TEST_TABBY_PAYMENT_COOKIE } from "@/lib/test-tabby-constants";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

function StatusPill({ status }: { status: string }) {
  const closed = status === "CLOSED";
  const authorized = status === "AUTHORIZED";
  const color = closed
    ? "bg-emerald-100 text-emerald-800"
    : authorized
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-800";
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-black ${color}`}>{status}</span>;
}

export default async function AdminTestTabbyPage({ searchParams }: Props) {
  // الوصول محكوم بصلاحية `/admin/test-tabby` في middleware — بلا قفل سوبر أدمن إضافي.
  await requireAdminPage();

  const sp = await searchParams;
  const configured = isTabbyConfigured();

  const jar = await cookies();
  const paymentId = jar.get(TEST_TABBY_PAYMENT_COOKIE)?.value ?? null;

  let payment: TabbyPayment | null = null;
  let lookupError: string | null = null;
  if (paymentId && configured) {
    try {
      payment = await fetchTabbyPayment(paymentId);
    } catch (e) {
      lookupError = e instanceof Error ? e.message : "فشل البحث عن الدفعة.";
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="اختبار بوابة تابي"
        description="أداة داخلية لسوبر أدمن فقط — تنفّذ عملية دفع حقيقية على بيئة الإنتاج الفعلية ثم تسمح بتحصيلها واستردادها، دون أي علاقة بحجوزات العملاء الحقيقية."
      />

      <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
        ⚠️ هذه الصفحة تستخدم مفاتيح تابي الحقيقية (إنتاج) وتحرّك مبلغاً فعلياً — استخدمها فقط
        للتحقق من أن الربط يعمل، وتأكد من تنفيذ الاسترداد بعد كل اختبار. تابي قد ترفض مبالغ
        صغيرة جداً (حد أدنى للطلب) — جرّب مبلغاً أعلى إذا ظهر خطأ أهلية.
      </div>

      {sp.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{sp.error}</p>
      ) : null}

      <AdminCard title="حالة الإعداد">
        {configured ? (
          <p className="text-sm font-bold text-emerald-700">
            بوابة تابي مهيّأة — مفاتيح البيئة موجودة (TABBY_PUBLIC_KEY / TABBY_SECRET_KEY).
          </p>
        ) : (
          <p className="text-sm font-bold text-red-700">
            بوابة تابي غير مهيّأة — أضف TABBY_PUBLIC_KEY و TABBY_SECRET_KEY في متغيرات البيئة.
          </p>
        )}
      </AdminCard>

      <AdminCard
        title="١) دفعة اختبار"
        description="ستُفتح صفحة الدفع المستضافة لدى تابي في نفس التبويب — أكمل الدفع، وستعود تلقائياً لهذه الصفحة."
      >
        <form action={startTabbyTestPaymentAction} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-bold text-on-surface-variant">
            المبلغ (ر.س)
            <input
              type="number"
              name="amountSar"
              defaultValue={200}
              min={1}
              step="0.01"
              required
              className="w-32 rounded-lg border border-outline-variant px-3 py-2 text-sm font-bold"
            />
          </label>
          <button
            type="submit"
            disabled={!configured}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-on-primary transition-opacity hover:opacity-95 disabled:opacity-50"
          >
            ابدأ دفعة اختبار
          </button>
        </form>
      </AdminCard>

      <AdminCard
        title="٢) نتيجة آخر دفعة اختبار"
        description="تُقرأ حالة الدفعة مباشرةً من تابي (وليس من إشعار محلي). التحصيل والاسترداد هنا يدويان لأن مرجع الاختبار (booking-0) يُتجاهَل عمداً من الـwebhook."
      >
        {!paymentId ? (
          <p className="text-sm font-medium text-on-surface-variant">
            لا توجد دفعة اختبار بعد — ابدأ واحدة من الأعلى.
          </p>
        ) : lookupError ? (
          <p className="text-sm font-bold text-red-700">تعذّر البحث عن الدفعة: {lookupError}</p>
        ) : !payment ? (
          <div className="space-y-2">
            <p className="text-sm font-bold text-amber-700">
              لم يُعثر على الدفعة بعد — قد يستغرق ثوانٍ بعد إتمام الدفع فعلياً.
            </p>
            <a
              href="/admin/test-tabby"
              className="inline-block rounded-lg border border-outline-variant px-4 py-2 text-xs font-bold text-primary hover:bg-surface-container"
            >
              تحديث الصفحة
            </a>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="font-bold text-on-surface-variant">معرّف الدفعة (paymentId): </span>
                <span dir="ltr" className="font-mono">{payment.id}</span>
              </p>
              <p>
                <span className="font-bold text-on-surface-variant">الحالة: </span>
                <StatusPill status={payment.status} />
              </p>
              <p>
                <span className="font-bold text-on-surface-variant">المبلغ: </span>
                {payment.amount} {payment.currency}
              </p>
            </div>

            {payment.status === "AUTHORIZED" ? (
              <TestTabbyCaptureForm paymentId={payment.id} amountSar={payment.amount} />
            ) : payment.status === "CLOSED" ? (
              <TestTabbyRefundForm paymentId={payment.id} amountSar={payment.amount} />
            ) : (
              <p className="text-xs font-bold text-on-surface-variant">
                الحالة الحالية ({payment.status}) لا تسمح بتحصيل أو استرداد.
              </p>
            )}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
