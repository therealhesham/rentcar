"use client";

import { useActionState, useState } from "react";
import { updateOtpDeliverySettings } from "@/app/admin/booking-otp-delivery-actions";
import type { BookingOtpChannel } from "@/lib/site-settings";
import type { WhatsappProvider } from "@/lib/meta-whatsapp";

type MetaConfigView = {
  phoneNumberId: string;
  apiVersion: string;
  loginProvider: WhatsappProvider;
  loginTemplateName: string;
  loginTemplateLang: string;
  checkoutProvider: WhatsappProvider;
  checkoutTemplateName: string;
  checkoutTemplateLang: string;
};

type Props = {
  loginChannel: BookingOtpChannel;
  checkoutChannel: BookingOtpChannel;
  meta: MetaConfigView;
  hasAccessToken: boolean;
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
  templateName,
  templateLang,
  warn,
}: {
  title: string;
  hint: string;
  prefix: "login" | "checkout";
  channel: BookingOtpChannel;
  setChannel: (c: BookingOtpChannel) => void;
  provider: WhatsappProvider;
  setProvider: (p: WhatsappProvider) => void;
  templateName: string;
  templateLang: string;
  warn: string | null;
}) {
  const isWa = channel === "WHATSAPP";
  const isMeta = isWa && provider === "meta";
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

      {/* الحقول تبقى في الـ DOM دائماً (مخفية فقط) كي لا تُمسح قيمها عند الحفظ. */}
      <div className={`space-y-2 ${isWa ? "" : "hidden"}`}>
        <p className="text-sm font-bold text-on-surface">مزوّد واتساب</p>
        <Choice
          name={`${prefix}Provider`}
          options={[
            { value: "evolution" as WhatsappProvider, label: "Evolution" },
            { value: "meta" as WhatsappProvider, label: "Meta (Cloud API)" },
          ]}
          value={provider}
          onChange={setProvider}
        />
      </div>

      <div className={`grid grid-cols-3 gap-3 ${isMeta ? "" : "hidden"}`}>
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs text-on-surface-variant">اسم القالب (Template)</span>
          <input
            type="text"
            name={`${prefix}TemplateName`}
            defaultValue={templateName}
            placeholder={prefix === "login" ? "login_otp" : "booking_otp"}
            dir="ltr"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-on-surface-variant">اللغة</span>
          <input
            type="text"
            name={`${prefix}TemplateLang`}
            defaultValue={templateLang}
            dir="ltr"
            className={inputCls}
          />
        </label>
      </div>

      {warn ? <p className="text-xs font-bold text-error">{warn}</p> : null}
    </section>
  );
}

export function BookingOtpDeliveryForm({
  loginChannel: initialLoginChannel,
  checkoutChannel: initialCheckoutChannel,
  meta,
  hasAccessToken,
  smsConfigured,
  mailConfigured,
  evolutionConfigured,
}: Props) {
  const [state, formAction, pending] = useActionState(updateOtpDeliverySettings, null);
  const [loginChannel, setLoginChannel] = useState(initialLoginChannel);
  const [loginProvider, setLoginProvider] = useState(meta.loginProvider);
  const [checkoutChannel, setCheckoutChannel] = useState(initialCheckoutChannel);
  const [checkoutProvider, setCheckoutProvider] = useState(meta.checkoutProvider);

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

  const usesMeta =
    (loginChannel === "WHATSAPP" && loginProvider === "meta") ||
    (checkoutChannel === "WHATSAPP" && checkoutProvider === "meta");

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <FlowCard
        title="تسجيل دخول العميل"
        hint="الرمز اللي يوصل للعميل لما يدخل من صفحة «دخول العميل»."
        prefix="login"
        channel={loginChannel}
        setChannel={setLoginChannel}
        provider={loginProvider}
        setProvider={setLoginProvider}
        templateName={meta.loginTemplateName}
        templateLang={meta.loginTemplateLang}
        warn={warnFor(loginChannel, loginProvider)}
      />

      <FlowCard
        title="تأكيد الحجز"
        hint="الرمز اللي يوصل للعميل قبل إتمام الحجز المباشر من الموقع."
        prefix="checkout"
        channel={checkoutChannel}
        setChannel={setCheckoutChannel}
        provider={checkoutProvider}
        setProvider={setCheckoutProvider}
        templateName={meta.checkoutTemplateName}
        templateLang={meta.checkoutTemplateLang}
        warn={warnFor(checkoutChannel, checkoutProvider)}
      />

      <section
        className={`space-y-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 ${
          usesMeta ? "" : "hidden"
        }`}
      >
        <div>
          <h3 className="text-base font-extrabold text-on-surface">بيانات اتصال Meta (Cloud API)</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            مشتركة بين التدفّقين — تظهر لأن واحداً منهما على Meta.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-on-surface">Phone Number ID</span>
          <input
            type="text"
            name="phoneNumberId"
            defaultValue={meta.phoneNumberId}
            dir="ltr"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-on-surface">Access Token</span>
          <input
            type="password"
            name="accessToken"
            autoComplete="off"
            placeholder={hasAccessToken ? "محفوظ — اتركه فارغاً للإبقاء عليه" : "الصق الـ token الدائم"}
            dir="ltr"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-on-surface">إصدار Graph API</span>
          <input
            type="text"
            name="apiVersion"
            defaultValue={meta.apiVersion}
            dir="ltr"
            className={inputCls}
          />
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
