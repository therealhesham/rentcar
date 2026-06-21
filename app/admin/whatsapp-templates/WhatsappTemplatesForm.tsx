"use client";

import { useActionState, useState } from "react";
import { WhatsappTemplatesState, updateWhatsappTemplatesState } from "./actions";
import { WHATSAPP_TEMPLATE_KEYS, WhatsAppTemplateKey } from "@/lib/whatsapp-templates";

type Props = {
  initialState: WhatsappTemplatesState;
};

const TEMPLATE_INFO: Record<WhatsAppTemplateKey, { label: string; description: string; vars: string }> = {
  whatsapp_template_customer_login_otp: {
    label: "رمز تسجيل الدخول",
    description: "تُرسل للعميل عند محاولة تسجيل الدخول للموقع.",
    vars: "{otp}",
  },
  whatsapp_template_booking_checkout_otp: {
    label: "رمز إتمام الحجز",
    description: "تُرسل للعميل للتحقق من رقمه عند إتمام الحجز.",
    vars: "{otp}",
  },
  whatsapp_template_booking_completion_customer: {
    label: "تأكيد الحجز (للعميل)",
    description: "تُرسل للعميل بعد الدفع الناجح أو التأكيد النقدي.",
    vars: "{fullName}, {bookingId}, {carTitle}, {pickupDate}, {dropoffDate}, {pickupDetails}, {branchLocation}, {paymentMethod}, {totalAmount}",
  },
  whatsapp_template_booking_completion_admin: {
    label: "إشعار حجز مدفوع/مؤكد (للإدارة)",
    description: "تُرسل لأرقام الصيانة والإدارة عند تأكيد حجز جديد.",
    vars: "{bookingId}, {carTitle}, {fullName}, {phone}, {branchLocation}, {pickupDate}, {numberOfDays}",
  },
  whatsapp_template_booking_received_customer: {
    label: "استلام طلب الحجز (للعميل)",
    description: "تُرسل للعميل فور تسجيل طلبه وقبل المراجعة.",
    vars: "{fullName}, {bookingId}, {carTitle}",
  },
  whatsapp_template_booking_received_admin: {
    label: "إشعار استلام طلب حجز (للإدارة)",
    description: "تُرسل للإدارة فور تسجيل طلب حجز جديد.",
    vars: "{bookingId}, {carTitle}, {fullName}, {phone}, {branchLocation}, {pickupDate}, {numberOfDays}",
  },
  whatsapp_template_booking_confirmed_customer: {
    label: "إشعار تأكيد الحجز المبدئي (للعميل)",
    description: "تُرسل للعميل بمجرد تأكيد الحجز من الموظف قبل الدفع.",
    vars: "{fullName}, {bookingId}, {carTitle}, {pickupDetails}, {pickupDate}, {numberOfDays}",
  },
};

export function WhatsappTemplatesForm({ initialState }: Props) {
  const [formState, formAction, pending] = useActionState(updateWhatsappTemplatesState, null);
  const [state, setState] = useState<WhatsappTemplatesState>(initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {WHATSAPP_TEMPLATE_KEYS.map((key) => {
          const info = TEMPLATE_INFO[key];
          return (
            <div key={key} className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-5 py-4 shadow-sm">
              <label className="mb-1 block text-sm font-bold text-on-surface">
                {info.label}
              </label>
              <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
                {info.description}
                <br />
                <span className="mt-1 inline-block font-mono text-[10px] text-primary" dir="ltr">
                  المتغيرات: {info.vars}
                </span>
              </p>
              <textarea
                name={key}
                dir="rtl"
                rows={5}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={state[key]}
                onChange={(e) => setState({ ...state, [key]: e.target.value })}
                required
              />
            </div>
          );
        })}
      </div>

      {formState?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">
          {formState.error}
        </p>
      ) : null}
      {formState?.ok ? (
        <p className="rounded-lg bg-primary-container/30 px-3 py-2 text-sm font-bold text-on-primary-container">
          تم حفظ الإعداد.
        </p>
      ) : null}

      <div className="flex items-center justify-end border-t border-outline-variant/20 pt-4">
        <button 
          type="submit" 
          disabled={pending}
          className="cursor-pointer rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "جاري الحفظ..." : "حفظ التعديلات"}
        </button>
      </div>
    </form>
  );
}
