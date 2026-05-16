"use client";

import { useActionState } from "react";
import { updateBookingOtpDelivery } from "@/app/admin/booking-otp-delivery-actions";
import type { BookingOtpChannel } from "@/lib/site-settings";

type Props = {
  currentChannel: BookingOtpChannel;
  smsUrlConfigured: boolean;
  mailConfigured: boolean;
  whatsappConfigured: boolean;
};

const OPTIONS: {
  value: BookingOtpChannel;
  title: string;
  hint: string;
}[] = [
  {
    value: "OFF",
    title: "بدون رمز تحقق",
    hint: "لا يُطلب من العميل رمزاً عند إتمام الحجز المباشر (كما كان قبل تفعيل الخدمة).",
  },
  {
    value: "SMS",
    title: "رسالة نصية (SMS) إلى جوال العميل",
    hint: "يُرسل رمز من 6 أرقام عبر طلب GET إلى الرابط المعرّف في البيئة (BOOKING_OTP_SMS_URL) مع العناصر {otp} و {phone} و {localPhone} و {message}.",
  },
  {
    value: "EMAIL",
    title: "بريد إلكتروني",
    hint: "يُرسل الرمز إلى نفس البريد الذي يُدخله العميل لإرسال الفاتورة، عبر SMTP أو Resend كما في إشعارات الموقع.",
  },
  {
    value: "WHATSAPP",
    title: "واتساب (Evolution API)",
    hint: "يُرسل رمز من 6 أرقام إلى جوال العميل عبر خدمة Evolution المعرّفة في البيئة (نفس إعداد إشعار الحجز بعد الدفع).",
  },
];

export function BookingOtpDeliveryForm({
  currentChannel,
  smsUrlConfigured,
  mailConfigured,
  whatsappConfigured,
}: Props) {
  const [state, formAction, pending] = useActionState(updateBookingOtpDelivery, null);

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <fieldset className="space-y-4">
        <legend className="text-base font-extrabold text-on-surface">قناة إرسال رمز التحقق</legend>
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
              currentChannel === opt.value
                ? "border-primary bg-primary-container/20"
                : "border-outline-variant/40 bg-surface-container-lowest hover:border-outline-variant"
            }`}
          >
            <input
              type="radio"
              name="channel"
              value={opt.value}
              defaultChecked={currentChannel === opt.value}
              className="mt-1 accent-primary"
            />
            <span>
              <span className="block font-bold text-on-surface">{opt.title}</span>
              <span className="mt-1 block text-sm text-on-surface-variant">{opt.hint}</span>
              {opt.value === "SMS" && !smsUrlConfigured ? (
                <span className="mt-2 block text-xs font-bold text-error">
                  التنبيه: BOOKING_OTP_SMS_URL غير مضبوط في البيئة — لن يعمل الإرسال حتى تضيفه.
                </span>
              ) : null}
              {opt.value === "EMAIL" && !mailConfigured ? (
                <span className="mt-2 block text-xs font-bold text-error">
                  التنبيه: إرسال البريد غير مهيأ (SMTP أو Resend) — لن يعمل الإرسال حتى تضبطه.
                </span>
              ) : null}
              {opt.value === "WHATSAPP" && !whatsappConfigured ? (
                <span className="mt-2 block text-xs font-bold text-error">
                  التنبيه: Evolution API غير مضبوط (EVOLUTION_API_BASE_URL و EVOLUTION_API_KEY و
                  EVOLUTION_INSTANCE_NAME) — لن يعمل الإرسال حتى تضيفه.
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>

      {state?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">
          {state.error}
        </p>
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
