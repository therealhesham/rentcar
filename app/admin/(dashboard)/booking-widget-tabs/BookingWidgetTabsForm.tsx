"use client";

import { useActionState } from "react";
import { updateBookingWidgetTabs } from "@/app/admin/booking-widget-tabs-actions";
import type { BookingWidgetTabFlags } from "@/lib/booking-widget-tabs";

type Props = {
  flags: BookingWidgetTabFlags;
};

const RENTAL_FIELDS: { key: keyof BookingWidgetTabFlags; label: string; hint: string }[] = [
  { key: "rentalDaily", label: "يومي", hint: "البحث باليوم في الأسطول." },
  { key: "rentalWeekly", label: "أسبوعي", hint: "مدة أسبوع تلقائياً." },
  { key: "rentalMonthly", label: "شهري", hint: "مدة شهر تقويمي تلقائياً." },
  { key: "rentalMonthlyPackages", label: "الباقات الشهرية", hint: "اشتراك شهري من الويدجت." },
  { key: "rentalCorporate", label: "حجز الشركات", hint: "نموذج تواصل للشركات." },
];

const MODE_FIELDS: { key: keyof BookingWidgetTabFlags; label: string; hint: string }[] = [
  { key: "modePickup", label: "استلام من الفرع", hint: "يظهر عند تفعيل أي نوع إيجار غير «حجز الشركات»." },
  { key: "modeDelivery", label: "توصيل لموقعي", hint: "نفس الشرط — يُخفى السطر بالكامل إن كان النوع الوحيد «حجز الشركات»." },
];

export function BookingWidgetTabsForm({ flags }: Props) {
  const [state, formAction, pending] = useActionState(updateBookingWidgetTabs, null);

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <fieldset className="space-y-3">
        <legend className="text-base font-extrabold text-on-surface">نوع الإيجار (الصف الأول)</legend>
        <p className="text-sm text-on-surface-variant">
          غير المفعّل لا يظهر كزر — الزائر يرى فقط الخيارات المتاحة فعلياً.
        </p>
        <ul className="space-y-2">
          {RENTAL_FIELDS.map(({ key, label, hint }) => (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 hover:border-outline-variant">
                <input
                  type="checkbox"
                  name={key}
                  defaultChecked={flags[key]}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  <span className="block font-bold text-on-surface">{label}</span>
                  <span className="mt-0.5 block text-xs text-on-surface-variant">{hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-extrabold text-on-surface">طريقة الاستلام (الصف الثاني)</legend>
        <p className="text-sm text-on-surface-variant">
          يخص البحث في الأسطول فقط (يومي / أسبوعي / شهري / باقات). إن عطّلت أحدهما بالكامل يُفعّل النظام تلقائياً
          خياراً واحداً عند الحفظ إن بقي النوعان معطّلين — يُفضّل ترك خيارين أو واحد بوعية.
        </p>
        <ul className="space-y-2">
          {MODE_FIELDS.map(({ key, label, hint }) => (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 hover:border-outline-variant">
                <input
                  type="checkbox"
                  name={key}
                  defaultChecked={flags[key]}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  <span className="block font-bold text-on-surface">{label}</span>
                  <span className="mt-0.5 block text-xs text-on-surface-variant">{hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-extrabold text-on-surface">إجازات ومواعيد الفروع (تقويم الحجز)</legend>
        <p className="text-sm text-on-surface-variant">
          التحكم في إمكانية اختيار أيام إجازات/عطلات الفروع في تقويم الكاليندر أثناء الحجز.
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 hover:border-outline-variant">
          <input
            type="checkbox"
            name="allowHolidayBooking"
            defaultChecked={flags.allowHolidayBooking}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="block font-bold text-on-surface">السماح بالحجز في الإجازات؟</span>
            <span className="mt-0.5 block text-xs text-on-surface-variant">
              عند ترك هذا الخيار <strong>غير مفعّل (الافتراضي)</strong>: تظهر أيام إجازات الفرع المحددة في جدول العمل بشكل <strong>جاف (معطّلة وغير قابلة للاختيار)</strong> في تقويم الحجز.
              عند تفعيله: يتم السماح للعميل باختيار أي تاريخ في الكاليندر حتى لو كان يوم إجازة للفرع.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-extrabold text-on-surface">تقييد المخزون وتوفر السيارات (Capacity Restriction)</legend>
        <p className="text-sm text-on-surface-variant">
          التحكم في التقييد بمخزون السيارات المتاحة بالفرع والحجوزات المتداخلة.
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 hover:border-outline-variant">
          <input
            type="checkbox"
            name="allowOverbooking"
            defaultChecked={flags.allowOverbooking}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="block font-bold text-on-surface">السماح بالحجز بدون تقييد بمخزون السيارات؟ (Overbooking)</span>
            <span className="mt-0.5 block text-xs text-on-surface-variant">
              عند ترك هذا الخيار <strong>غير مفعّل (الافتراضي - التقييد محكم)</strong>: يمنع النظام الحجز إذا اكتمل عدد السيارات أو إذا كانت الكمية صفر وتظهر رسالة <strong>«غير متاح خلال هذه الفترة»</strong>.
              عند تفعيله: يلغى التقييد بالكمية المتاحة والتداخلات ويُسمح للعملاء بالحجز دائماً دون إغلاق الموديلات.
            </span>
          </span>
        </label>
      </fieldset>

      {state?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg bg-primary-container/30 px-3 py-2 text-sm font-bold text-on-primary-container">
          تم حفظ الإعداد.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity disabled:opacity-60"
      >
        {pending ? "جاري الحفظ…" : "حفظ"}
      </button>
    </form>
  );
}
