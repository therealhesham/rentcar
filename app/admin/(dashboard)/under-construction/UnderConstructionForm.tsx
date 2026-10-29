"use client";

import { useActionState } from "react";
import { updateUnderConstruction } from "@/app/admin/under-construction-actions";
import {
  DEFAULT_UNDER_CONSTRUCTION_MESSAGE,
  UNDER_CONSTRUCTION_MESSAGE_MAX,
} from "@/lib/under-construction";

type Props = {
  enabled: boolean;
  message: string;
};

export function UnderConstructionForm({ enabled, message }: Props) {
  const [state, formAction, pending] = useActionState(updateUnderConstruction, null);

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 hover:border-outline-variant">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="block font-bold text-on-surface">تفعيل وضع «قيد الإنشاء»</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-on-surface-variant">
            يرى الزائر صفحة «قيد الإنشاء» بدل الموقع، وتُرسَل ترويسة{" "}
            <span className="font-mono" dir="ltr">
              noindex
            </span>{" "}
            لمحركات البحث لتتوقف عن فهرسة الصفحات (يستغرق اختفاء الصفحات القديمة من نتائج البحث
            وقتاً حتى يعيد جوجل زحفها).
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <label htmlFor="uc-message" className="block text-sm font-bold text-on-surface">
          الرسالة للزائر (اختياري)
        </label>
        <textarea
          id="uc-message"
          name="message"
          defaultValue={message}
          rows={3}
          maxLength={UNDER_CONSTRUCTION_MESSAGE_MAX}
          placeholder={DEFAULT_UNDER_CONSTRUCTION_MESSAGE}
          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
        />
      </div>

      <p className="rounded-lg bg-surface-container-lowest px-3 py-2 text-xs leading-relaxed text-on-surface-variant">
        ملاحظة: أنت مسجّل دخول كمسؤول فسيظل الموقع ظاهراً لك. لتجربة ما يراه الزائر افتح الموقع في
        نافذة خاصة (Incognito). روابط الـ API وبوابات الدفع لا تتأثر.
      </p>

      {state?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg bg-primary-container/30 px-3 py-2 text-sm font-bold text-on-primary-container">
          تم حفظ الإعداد (قد يستغرق التطبيق حتى 5 ثوانٍ).
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
