"use client";

import { useActionState, useState } from "react";
import { updateOtpDeliverySettings } from "@/app/admin/booking-otp-delivery-actions";
import type { BookingOtpChannel } from "@/lib/site-settings";
import type { WhatsappProvider } from "@/lib/rasayily-whatsapp";

type RasayilyConfigView = {
  companyId: string;
  loginProvider: WhatsappProvider;
  checkoutProvider: WhatsappProvider;
};

type Props = {
  loginChannel: BookingOtpChannel;
  checkoutChannel: BookingOtpChannel;
  rasayily: RasayilyConfigView;
  hasApiToken: boolean;
  smsConfigured: boolean;
  mailConfigured: boolean;
  evolutionConfigured: boolean;
};

const CHANNELS: { value: BookingOtpChannel; label: string }[] = [
  { value: "OFF", label: "بدون رمز" },
  { value: "SMS", label: "SMS" },
  { value: "WHATSAPP", label: "واتساب" },
  { value: "EMAIL", label: "بريد إلكتروني" },
];

const PROVIDERS: { value: WhatsappProvider; label: string }[] = [
  { value: "evolution", label: "Evolution" },
  { value: "rasayily", label: "رسائلي" },
];

const inputCls =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm font-mono";

function Choice<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
            value === o.value
              ? "border-primary bg-primary-container/20 text-on-surface"
              : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-outline-variant"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function FlowCard({
  title,
  hint,
  prefix,
  channel,
  setChannel,
  provider,
  setProvider,
  warn,
}: {
  title: string;
  hint: string;
  prefix: "login" | "checkout";
  channel: BookingOtpChannel;
  setChannel: (c: BookingOtpChannel) => void;
  provider: WhatsappProvider;
  setProvider: (p: WhatsappProvider) => void;
  warn: string | null;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
      <div>
        <h3 className="text-base font-extrabold text-on-surface">{title}</h3>
        <p className="mt-1 text-sm text-on-surface-variant">{hint}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-on-surface">قناة الإرسال</p>
        <Choice name={`${prefix}Channel`} options={CHANNELS} value={channel} onChange={setChannel} />
      </div>

      {/* يبقى في الـ DOM دائماً (مخفي فقط) كي لا تُمسح قيمته عند الحفظ. */}
      <div className={`space-y-2 ${channel === "WHATSAPP" ? "" : "hidden"}`}>
        <p className="text-sm font-bold text-on-surface">مزوّد واتساب</p>
        <Choice name={`${prefix}Provider`} options={PROVIDERS} value={provider} onChange={setProvider} />
      </div>

      {warn ? <p className="text-xs font-bold text-error">{warn}</p> : null}
    </section>
  );
}

export function BookingOtpDeliveryForm({
  loginChannel: initialLoginChannel,
  checkoutChannel: initialCheckoutChannel,
  rasayily,
  hasApiToken,
  smsConfigured,
  mailConfigured,
  evolutionConfigured,
}: Props) {
  const [state, formAction, pending] = useActionState(updateOtpDeliverySettings, null);
  const [loginChannel, setLoginChannel] = useState(initialLoginChannel);
  const [loginProvider, setLoginProvider] = useState(rasayily.loginProvider);
  const [checkoutChannel, setCheckoutChannel] = useState(initialCheckoutChannel);
  const [checkoutProvider, setCheckoutProvider] = useState(rasayily.checkoutProvider);

  const warnFor = (channel: BookingOtpChannel, provider: WhatsappProvider): string | null => {
    if (channel === "SMS" && !smsConfigured) {
      return "خدمة الرسائل غير مضبوطة — أضف MSEGAT_USERNAME و MSEGAT_API_KEY و MSEGAT_SENDER في البيئة.";
    }
    if (channel === "EMAIL" && !mailConfigured) {
      return "إرسال البريد غير مهيأ (SMTP أو Resend).";
    }
    if (channel === "WHATSAPP" && provider === "evolution" && !evolutionConfigured) {
      return "Evolution غير مضبوط في البيئة (EVOLUTION_API_BASE_URL و EVOLUTION_API_KEY و EVOLUTION_INSTANCE_NAME).";
    }
    return null;
  };

  const usesRasayily =
    (loginChannel === "WHATSAPP" && loginProvider === "rasayily") ||
    (checkoutChannel === "WHATSAPP" && checkoutProvider === "rasayily");

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <FlowCard
        title="تسجيل دخول العميل"
        hint="رمز التحقق اللي يوصل للعميل لما يدخل من صفحة «دخول العميل»."
        prefix="login"
        channel={loginChannel}
        setChannel={setLoginChannel}
        provider={loginProvider}
        setProvider={setLoginProvider}
        warn={warnFor(loginChannel, loginProvider)}
      />

      <FlowCard
        title="تأكيد الحجز"
        hint="رمز التحقق اللي يوصل للعميل قبل إتمام الحجز المباشر من الموقع."
        prefix="checkout"
        channel={checkoutChannel}
        setChannel={setCheckoutChannel}
        provider={checkoutProvider}
        setProvider={setCheckoutProvider}
        warn={warnFor(checkoutChannel, checkoutProvider)}
      />

      <section
        className={`space-y-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 ${
          usesRasayily ? "" : "hidden"
        }`}
      >
        <div>
          <h3 className="text-base font-extrabold text-on-surface">بيانات اتصال رسائلي</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            مشتركة بين التدفّقين. نص الرسالة هو نفس قالب الواتساب المحفوظ للدخول/الحجز (فيه {"{otp}"}).
            رسائلي تعالج الطلب في طابور، فنجاح الإرسال يعني القبول وليس تأكيد التسليم.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-on-surface">API Token</span>
          <input
            type="password"
            name="apiToken"
            autoComplete="off"
            placeholder={hasApiToken ? "محفوظ — اتركه فارغاً للإبقاء عليه" : "الصق الـ token"}
            dir="ltr"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-on-surface">Company ID</span>
          <input type="text" name="companyId" defaultValue={rasayily.companyId} dir="ltr" className={inputCls} />
        </label>
      </section>

      {state?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg bg-primary-container/30 px-3 py-2 text-sm font-bold text-on-primary-container">
          تم حفظ الإعدادات.
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
