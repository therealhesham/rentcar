"use client";

import { useActionState, useState } from "react";
import { updateMobileAppWhatsappOtpConfig } from "@/app/admin/mobile-app-settings-actions";
import type { MobileAppWhatsappOtpConfig } from "@/lib/mobile-app-whatsapp-otp-config";

type Props = {
  config: MobileAppWhatsappOtpConfig;
};

export function MobileAppWhatsappOtpForm({ config }: Props) {
  const [state, formAction, pending] = useActionState(updateMobileAppWhatsappOtpConfig, null);
  const [enabled, setEnabled] = useState(config.enabled);

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <div>
        <h3 className="font-bold text-on-surface">رمز تسجيل الدخول عبر واتساب</h3>
        <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
          بيانات اتصال Evolution API المستخدمة لإرسال رمز تسجيل الدخول للعميل في تطبيق روائس.{" "}
          <span className="font-bold text-on-surface">هذه هي البيانات الوحيدة التي يعتمد عليها السيرفر</span> — لا يوجد أي إعداد بديل في ملفات السيرفر.
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
          <span className="block font-bold text-on-surface">تفعيل خدمة رمز تسجيل الدخول</span>
          <span className="mt-0.5 block text-xs text-on-surface-variant">
            لو معطّلة، هيفشل تسجيل الدخول في التطبيق بغض النظر عن باقي الحقول.
          </span>
        </span>
      </label>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-on-surface">رابط Evolution API</span>
          <input
            type="text"
            name="apiBaseUrl"
            defaultValue={config.apiBaseUrl}
            placeholder="http://31.97.55.12:32771"
            dir="ltr"
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-on-surface">مفتاح API</span>
          <input
            type="text"
            name="apiKey"
            defaultValue={config.apiKey}
            dir="ltr"
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-on-surface">اسم الـ Instance</span>
          <input
            type="text"
            name="instanceName"
            defaultValue={config.instanceName}
            placeholder="Rawaes"
            dir="ltr"
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm font-mono"
          />
        </label>
      </div>

      {state?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg bg-primary-container/30 px-3 py-2 text-sm font-bold text-on-primary-container">
          تم حفظ إعدادات واتساب.
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
