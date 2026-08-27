"use client";

import { useActionState, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  checkAmkanOrderStatusAction,
  createAmkanTestOrderAction,
  probeAmkanMerchantConfigAction,
  type AmkanProbeState,
} from "@/app/admin/test-amkan-actions";

type Props = {
  /** ما هو مضبوط فعلاً في البيئة — لعرض الحالة وملء القيم الافتراضية. */
  env: {
    hasCredentials: boolean;
    merchantId: string;
    apiBase: string;
    merchantCode: string;
    originSourceChannel: string;
  };
};

const inputClass =
  "w-full rounded-xl border border-outline-variant/40 px-3 py-2 text-sm outline-none focus:border-primary";
const labelClass = "mb-1 block text-xs font-bold text-on-surface-variant";
const btnClass =
  "rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-on-primary disabled:opacity-50";

function Result({ state }: { state: AmkanProbeState | null }) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" dir="auto">
        {state.error}
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      {state.hint ? (
        <p className="whitespace-pre-line rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900" dir="auto">
          {state.hint}
        </p>
      ) : null}
      {state.raw ? (
        <pre
          dir="ltr"
          className="max-h-96 overflow-auto rounded-xl bg-surface-container-low/60 p-4 text-left text-xs leading-relaxed"
        >
          {state.raw}
        </pre>
      ) : null}
    </div>
  );
}

export function TestAmkanPanel({ env }: Props) {
  // معرّف التاجر وعنوان البيئة مشتركان بين النماذج الثلاثة، فيُحفظان هنا ويُمرَّران
  // في كل نموذج كحقل مخفي — أبسط من رفع الحالة إلى الخادم لأداة تشخيص.
  const [merchantId, setMerchantId] = useState(env.merchantId);
  const [apiBase, setApiBase] = useState(env.apiBase || "https://sit-gw-pub.emkanfinance.com.sa");

  const [probeState, probeAction, probing] = useActionState(probeAmkanMerchantConfigAction, null);
  const [orderState, orderAction, ordering] = useActionState(createAmkanTestOrderAction, null);
  const [statusState, statusAction, checking] = useActionState(checkAmkanOrderStatusAction, null);

  const shared = (
    <>
      <input type="hidden" name="merchantId" value={merchantId} />
      <input type="hidden" name="apiBase" value={apiBase} />
    </>
  );

  return (
    <div className="space-y-6">
      <AdminCard
        title="١) بيانات الاتصال"
        description="اسم المستخدم وكلمة المرور تُقرآن من .env فقط ولا تُعرضان هنا. الباقي قابل للتجريب قبل تثبيته."
      >
        {!env.hasCredentials ? (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            ⚠️ AMKAN_USERNAME و AMKAN_PASSWORD غير موجودين في <code>.env</code> — لن يعمل أي نداء.
          </p>
        ) : (
          <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
            ✅ بيانات المصادقة موجودة في البيئة.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>merchantId (مطلوب لكل نداء)</label>
            <input
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="لم يصل بعد من إمكان"
              className={inputClass}
              dir="ltr"
            />
          </div>
          <div>
            <label className={labelClass}>apiBase</label>
            <input
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              className={inputClass}
              dir="ltr"
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard
        title="٢) فحص الإعدادات — merchantConfig"
        description="نداء واحد يكشف merchantCode وserviceStatus والحدود الأربعة. يحسم عملياً أي زوج حدود تعتمده إمكان لطلبات BNPL."
      >
        <form action={probeAction}>
          {shared}
          <button type="submit" disabled={probing} className={btnClass}>
            {probing ? "جارٍ الفحص…" : "افحص الآن"}
          </button>
        </form>
        <Result state={probeState} />
      </AdminCard>

      <AdminCard
        title="٣) إنشاء طلب تمويل تجريبي"
        description="يُنشأ بـ bookingRequestId = 0 فلا يمسّ أي حجز حقيقي — أي إشعار عنه يتجاهله الويب هوك."
      >
        <form action={orderAction} className="space-y-4">
          {shared}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>merchantCode</label>
              <input
                name="merchantCode"
                defaultValue={env.merchantCode}
                placeholder="من نتيجة الفحص أعلاه"
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div>
              <label className={labelClass}>origin-source-channel (القيمة المجهولة)</label>
              <input
                name="originSourceChannel"
                defaultValue={env.originSourceChannel || "Neoleap_POS"}
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div>
              <label className={labelClass}>المبلغ (ر.س)</label>
              <input
                name="amountSar"
                type="number"
                step="0.01"
                defaultValue={500}
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div>
              <label className={labelClass}>رقم الجوال</label>
              <input
                name="mobileNumber"
                placeholder="966541710298 أو 0541710298"
                className={inputClass}
                dir="ltr"
              />
            </div>
          </div>
          <button type="submit" disabled={ordering} className={btnClass}>
            {ordering ? "جارٍ الإنشاء…" : "أنشئ طلباً تجريبياً"}
          </button>
        </form>
        <Result state={orderState} />
      </AdminCard>

      <AdminCard title="٤) استعلام حالة طلب" description="بعد إكمال الرحلة على صفحة إمكان — COMPLETED تعني نجاح الدفعة الأولى.">
        <form action={statusAction} className="space-y-4">
          {shared}
          <div>
            <label className={labelClass}>orderCode (معرّف إمكان)</label>
            <input name="orderCode" className={inputClass} dir="ltr" />
          </div>
          <button type="submit" disabled={checking} className={btnClass}>
            {checking ? "جارٍ الاستعلام…" : "استعلم"}
          </button>
        </form>
        <Result state={statusState} />
      </AdminCard>
    </div>
  );
}
