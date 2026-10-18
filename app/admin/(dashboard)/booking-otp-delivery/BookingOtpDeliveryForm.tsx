"use client";

import { useActionState, useState } from "react";
import { updateOtpDeliverySettings } from "@/app/admin/booking-otp-delivery-actions";
import type { BookingOtpChannel } from "@/lib/site-settings";
import type { WhatsappProvider } from "@/lib/whatsapp-otp";

type ConfigView = {
  loginProvider: WhatsappProvider;
  loginTemplateName: string;
  loginTemplateLang: string;
  checkoutProvider: WhatsappProvider;
  checkoutTemplateName: string;
  checkoutTemplateLang: string;
  bookingCompletionProvider: WhatsappProvider;
  bookingCompletionTemplateName: string;
  bookingCompletionTemplateLang: string;
  bookingConfirmedProvider: WhatsappProvider;
  bookingConfirmedTemplateName: string;
  bookingConfirmedTemplateLang: string;
  bookingCompletionAdminProvider: WhatsappProvider;
  bookingCompletionAdminTemplateName: string;
  bookingCompletionAdminTemplateLang: string;
  phoneNumberId: string;
  apiVersion: string;
  rasayilyCompanyId: string;
};

type Props = {
  loginChannel: BookingOtpChannel;
  checkoutChannel: BookingOtpChannel;
  config: ConfigView;
  hasAccessToken: boolean;
  hasRasayilyToken: boolean;
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
  { value: "meta", label: "Meta (قالب معتمد)" },
  { value: "rasayily", label: "رسائلي" },
];

/** لكروت رسائل الحجز الجاهزة (مش تدفّقات الـ OTP) — فيها خيار تعطيل الإرسال تماماً. */
const PROVIDERS_WITH_NONE: { value: WhatsappProvider; label: string }[] = [
  ...PROVIDERS,
  { value: "none", label: "بدون إرسال" },
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
        <Choice name={`${prefix}Provider`} options={PROVIDERS} value={provider} onChange={setProvider} />
      </div>

      <div className={`grid grid-cols-3 gap-3 ${isWa && provider === "meta" ? "" : "hidden"}`}>
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

      {isWa && provider === "rasayily" ? (
        <p className="text-xs text-on-surface-variant">
          رسائلي ترسل نصاً حراً فقط — لو الربط عندهم على Meta الرسمي قد لا يصل الرمز لعميل لم يراسل الشركة خلال
          24 ساعة. في هذه الحالة استخدم Meta.
        </p>
      ) : null}

      {warn ? <p className="text-xs font-bold text-error">{warn}</p> : null}
    </section>
  );
}

function BookingMessageCard({
  title,
  hint,
  fieldPrefix,
  metaNamedParams,
  templateNamePlaceholder,
  provider,
  setProvider,
  templateName,
  templateLang,
  warn,
}: {
  title: string;
  hint: string;
  fieldPrefix: string;
  metaNamedParams: string;
  templateNamePlaceholder: string;
  provider: WhatsappProvider;
  setProvider: (p: WhatsappProvider) => void;
  templateName: string;
  templateLang: string;
  warn: string | null;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
      <div>
        <h3 className="text-base font-extrabold text-on-surface">{title}</h3>
        <p className="mt-1 text-sm text-on-surface-variant">{hint}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-on-surface">مزوّد واتساب</p>
        <Choice
          name={`${fieldPrefix}Provider`}
          options={PROVIDERS_WITH_NONE}
          value={provider}
          onChange={setProvider}
        />
      </div>

      <div className={`grid grid-cols-3 gap-3 ${provider === "meta" ? "" : "hidden"}`}>
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs text-on-surface-variant">اسم القالب (Template)</span>
          <input
            type="text"
            name={`${fieldPrefix}TemplateName`}
            defaultValue={templateName}
            placeholder={templateNamePlaceholder}
            dir="ltr"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-on-surface-variant">اللغة</span>
          <input
            type="text"
            name={`${fieldPrefix}TemplateLang`}
            defaultValue={templateLang}
            dir="ltr"
            className={inputCls}
          />
        </label>
      </div>

      {provider === "meta" ? (
        <p className="text-xs text-on-surface-variant" dir="ltr">
          Meta named parameters: {metaNamedParams} — لازم أسماء المتغيرات في القالب المعتمد تطابق دي بالظبط.
        </p>
      ) : null}

      {provider === "rasayily" ? (
        <p className="text-xs text-on-surface-variant">
          رسائلي ترسل نص الرسالة المحفوظ في صفحة «قوالب واتساب» كنص حر، وليس القالب المعتمد على Meta.
        </p>
      ) : null}

      {provider === "none" ? (
        <p className="text-xs text-on-surface-variant">هذه الرسالة معطّلة — مش هتتبعت لحد.</p>
      ) : null}

      {warn ? <p className="text-xs font-bold text-error">{warn}</p> : null}
    </section>
  );
}

export function BookingOtpDeliveryForm({
  loginChannel: initialLoginChannel,
  checkoutChannel: initialCheckoutChannel,
  config,
  hasAccessToken,
  hasRasayilyToken,
  smsConfigured,
  mailConfigured,
  evolutionConfigured,
}: Props) {
  const [state, formAction, pending] = useActionState(updateOtpDeliverySettings, null);
  const [loginChannel, setLoginChannel] = useState(initialLoginChannel);
  const [loginProvider, setLoginProvider] = useState(config.loginProvider);
  const [checkoutChannel, setCheckoutChannel] = useState(initialCheckoutChannel);
  const [checkoutProvider, setCheckoutProvider] = useState(config.checkoutProvider);
  const [bookingCompletionProvider, setBookingCompletionProvider] = useState(
    config.bookingCompletionProvider,
  );
  const [bookingConfirmedProvider, setBookingConfirmedProvider] = useState(
    config.bookingConfirmedProvider,
  );
  const [bookingCompletionAdminProvider, setBookingCompletionAdminProvider] = useState(
    config.bookingCompletionAdminProvider,
  );

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

  const warnForProvider = (provider: WhatsappProvider): string | null => {
    if (provider === "evolution" && !evolutionConfigured) {
      return "Evolution غير مضبوط في البيئة (EVOLUTION_API_BASE_URL و EVOLUTION_API_KEY و EVOLUTION_INSTANCE_NAME).";
    }
    return null;
  };

  const uses = (p: WhatsappProvider) =>
    (loginChannel === "WHATSAPP" && loginProvider === p) ||
    (checkoutChannel === "WHATSAPP" && checkoutProvider === p) ||
    bookingCompletionProvider === p ||
    bookingConfirmedProvider === p ||
    bookingCompletionAdminProvider === p;

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
        templateName={config.loginTemplateName}
        templateLang={config.loginTemplateLang}
        warn={warnFor(loginChannel, loginProvider)}
      />

      <FlowCard
        title="رمز تأكيد الحجز"
        hint="رمز التحقق اللي يوصل للعميل قبل إتمام الحجز المباشر من الموقع."
        prefix="checkout"
        channel={checkoutChannel}
        setChannel={setCheckoutChannel}
        provider={checkoutProvider}
        setProvider={setCheckoutProvider}
        templateName={config.checkoutTemplateName}
        templateLang={config.checkoutTemplateLang}
        warn={warnFor(checkoutChannel, checkoutProvider)}
      />

      <BookingMessageCard
        title="تأكيد الحجز (رسالة بعد الدفع)"
        hint="رسالة واتساب كاملة التفاصيل تُرسل للعميل تلقائياً بعد نجاح الدفع أو التأكيد النقدي."
        fieldPrefix="bookingCompletion"
        templateNamePlaceholder="booking_completion"
        metaNamedParams="fullname, bookingid, cartitle, pickupdate, dropoffdate, pickupdetails, branchlocation, paymentmethod, totalamount"
        provider={bookingCompletionProvider}
        setProvider={setBookingCompletionProvider}
        templateName={config.bookingCompletionTemplateName}
        templateLang={config.bookingCompletionTemplateLang}
        warn={warnForProvider(bookingCompletionProvider)}
      />

      <BookingMessageCard
        title="إشعار تأكيد الحجز المبدئي"
        hint="رسالة واتساب تُرسل للعميل فور ما الموظف يأكد الحجز غير النقدي، قبل الدفع."
        fieldPrefix="bookingConfirmed"
        templateNamePlaceholder="booking_confirmed"
        metaNamedParams="fullname, bookingid, cartitle, pickupdetails, pickupdate, numberofdays"
        provider={bookingConfirmedProvider}
        setProvider={setBookingConfirmedProvider}
        templateName={config.bookingConfirmedTemplateName}
        templateLang={config.bookingConfirmedTemplateLang}
        warn={warnForProvider(bookingConfirmedProvider)}
      />

      <BookingMessageCard
        title="إشعار حجز مدفوع/مؤكد (الإدارة)"
        hint="تُرسل لأرقام الصيانة/الإدارة (maintenance_whatsapp_numbers) في نفس لحظة رسالة تأكيد الحجز للعميل."
        fieldPrefix="bookingCompletionAdmin"
        templateNamePlaceholder="booking_completion_admin"
        metaNamedParams="bookingid, cartitle, fullname, phone, branchlocation, pickupdate, numberofdays"
        provider={bookingCompletionAdminProvider}
        setProvider={setBookingCompletionAdminProvider}
        templateName={config.bookingCompletionAdminTemplateName}
        templateLang={config.bookingCompletionAdminTemplateLang}
        warn={warnForProvider(bookingCompletionAdminProvider)}
      />

      <section
        className={`space-y-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 ${
          uses("meta") ? "" : "hidden"
        }`}
      >
        <div>
          <h3 className="text-base font-extrabold text-on-surface">بيانات اتصال Meta (Cloud API)</h3>
          <p className="mt-1 text-sm text-on-surface-variant">مشتركة بين التدفّقين.</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-on-surface">Phone Number ID</span>
          <input type="text" name="phoneNumberId" defaultValue={config.phoneNumberId} dir="ltr" className={inputCls} />
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
          <input type="text" name="apiVersion" defaultValue={config.apiVersion} dir="ltr" className={inputCls} />
        </label>
      </section>

      <section
        className={`space-y-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 ${
          uses("rasayily") ? "" : "hidden"
        }`}
      >
        <div>
          <h3 className="text-base font-extrabold text-on-surface">بيانات اتصال رسائلي</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            نص الرسالة هو نفس قالب الواتساب المحفوظ للدخول/الحجز. رسائلي تعالج الطلب في طابور، فالنجاح يعني القبول
            وليس تأكيد التسليم.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-on-surface">Company ID</span>
          <input
            type="text"
            name="rasayilyCompanyId"
            defaultValue={config.rasayilyCompanyId}
            dir="ltr"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-on-surface">API Token</span>
          <input
            type="password"
            name="rasayilyToken"
            autoComplete="off"
            placeholder={hasRasayilyToken ? "محفوظ — اتركه فارغاً للإبقاء عليه" : "الصق الـ token"}
            dir="ltr"
            className={inputCls}
          />
        </label>
      </section>

      {state?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">{state.error}</p>
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
