"use client";

import { useActionState, useState } from "react";
import { updateMetaWhatsappOtpConfig } from "@/app/admin/booking-otp-delivery-actions";

type Props = {
  config: {
    enabled: boolean;
    loginEnabled: boolean;
    checkoutEnabled: boolean;
    phoneNumberId: string;
    apiVersion: string;
    loginTemplateName: string;
    loginTemplateLang: string;
    checkoutTemplateName: string;
    checkoutTemplateLang: string;
    templateHasCopyButton: boolean;
  };
  hasAccessToken: boolean;
};

const inputCls =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm font-mono";

export function MetaWhatsappOtpForm({ config, hasAccessToken }: Props) {
  const [state, formAction, pending] = useActionState(updateMetaWhatsappOtpConfig, null);
  const [enabled, setEnabled] = useState(config.enabled);
  const [loginOn, setLoginOn] = useState(config.loginEnabled);
  const [checkoutOn, setCheckoutOn] = useState(config.checkoutEnabled);

  return (
    <form
      action={formAction}
      className="mt-8 max-w-2xl space-y-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <div>
        <h3 className="text-base font-extrabold text-on-surface">واتساب عبر Meta (Cloud API)</h3>
        <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
          يرسل رمز التحقق بقالب معتمد من Meta بدل Evolution. يعمل فقط عندما تكون القناة أعلاه «واتساب».
          أي تدفّق لا تفعّله هنا يبقى على Evolution كما هو.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 hover:border-outline-variant">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="block font-bold text-on-surface">تفعيل Meta</span>
          <span className="mt-0.5 block text-xs text-on-surface-variant">
            عند الإلغاء يرجع كل شيء إلى Evolution فوراً.
          </span>
        </span>
      </label>

      <fieldset
        className={`space-y-4 border-s-2 border-outline-variant/40 ps-4 ${enabled ? "" : "opacity-50"}`}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-on-surface">Phone Number ID</span>
          <input
            type="text"
            name="phoneNumberId"
            defaultValue={config.phoneNumberId}
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
            defaultValue={config.apiVersion}
            dir="ltr"
            className={inputCls}
          />
        </label>

        <div className="space-y-3 pt-2">
          <p className="text-sm font-bold text-on-surface">استخدم Meta في:</p>

          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                name="loginEnabled"
                checked={loginOn}
                onChange={(e) => setLoginOn(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span className="font-bold text-on-surface">تسجيل الدخول</span>
            </label>
            <div className={`mt-3 grid grid-cols-3 gap-3 ${loginOn ? "" : "opacity-50"}`}>
              <label className="col-span-2 block">
                <span className="mb-1 block text-xs text-on-surface-variant">اسم القالب (Template)</span>
                <input
                  type="text"
                  name="loginTemplateName"
                  defaultValue={config.loginTemplateName}
                  
                  placeholder="login_otp"
                  dir="ltr"
                  className={`${inputCls}`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-on-surface-variant">اللغة</span>
                <input
                  type="text"
                  name="loginTemplateLang"
                  defaultValue={config.loginTemplateLang}
                  
                  dir="ltr"
                  className={`${inputCls}`}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                name="checkoutEnabled"
                checked={checkoutOn}
                onChange={(e) => setCheckoutOn(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span className="font-bold text-on-surface">تأكيد الحجز (رمز إتمام الحجز)</span>
            </label>
            <div className={`mt-3 grid grid-cols-3 gap-3 ${checkoutOn ? "" : "opacity-50"}`}>
              <label className="col-span-2 block">
                <span className="mb-1 block text-xs text-on-surface-variant">اسم القالب (Template)</span>
                <input
                  type="text"
                  name="checkoutTemplateName"
                  defaultValue={config.checkoutTemplateName}
                  
                  placeholder="booking_otp"
                  dir="ltr"
                  className={`${inputCls}`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-on-surface-variant">اللغة</span>
                <input
                  type="text"
                  name="checkoutTemplateLang"
                  defaultValue={config.checkoutTemplateLang}
                  
                  dir="ltr"
                  className={`${inputCls}`}
                />
              </label>
            </div>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="templateHasCopyButton"
            defaultChecked={config.templateHasCopyButton}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="block text-sm font-bold text-on-surface">القالب من نوع Authentication (فيه زر نسخ الرمز)</span>
            <span className="mt-0.5 block text-xs text-on-surface-variant">
              قوالب المصادقة في Meta تتطلب تمرير الرمز في النص وفي الزر. ألغِ التحديد لو القالب بدون زر.
            </span>
          </span>
        </label>
      </fieldset>

      {state?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg bg-primary-container/30 px-3 py-2 text-sm font-bold text-on-primary-container">
          تم حفظ إعدادات Meta.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity disabled:opacity-60"
      >
        {pending ? "جاري الحفظ…" : "حفظ إعدادات Meta"}
      </button>
    </form>
  );
}
