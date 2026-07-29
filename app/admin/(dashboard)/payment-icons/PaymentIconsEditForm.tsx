"use client";

import { useActionState } from "react";
import { updatePaymentIcons } from "@/app/admin/payment-icons-actions";
import { AdminImageField } from "@/components/admin/AdminImageField";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { PAYMENT_ICON_METHODS, type PaymentIconUrls } from "@/lib/site-settings";

export function PaymentIconsEditForm({ current }: { current: PaymentIconUrls }) {
  const [state, formAction, pending] = useActionState(updatePaymentIcons, null);

  return (
    <form
      action={formAction}
      className="grid gap-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <p className="text-sm text-on-surface-variant">
        الشعارات المعروضة أمام كل وسيلة دفع في صفحة إتمام الدفع. اختر من المعرض أو ارفع صورة جديدة
        لكل وسيلة — اترك الملف والمعرض فارغين للإبقاء على الشعار الحالي.
      </p>

      {PAYMENT_ICON_METHODS.map((method) => (
        <div key={method} className="border-t border-outline-variant/20 pt-5 first:border-t-0 first:pt-0">
          <input type="hidden" name={`currentImage_${method}`} value={current[method]} />
          <AdminImageField
            label={`شعار ${bookingPaymentMethodLabelAr(method)}`}
            currentImageUrl={current[method]}
            galleryFieldName={`galleryImageUrl_${method}`}
            fileFieldName={`imageFile_${method}`}
            fileHelp="اترك الملف والمعرض فارغين للإبقاء على الشعار الحالي. بحد أقصى 5 ميجابايت."
          />
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ الأيقونات"}
        </button>
      </div>

      {state?.ok ? (
        <p className="text-sm font-bold text-primary" role="status">
          تم حفظ أيقونات وسائل الدفع بنجاح.
        </p>
      ) : null}
      {state?.error ? (
        <p className="text-sm font-bold text-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
