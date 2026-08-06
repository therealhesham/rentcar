"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import {
  updatePrivacyPolicy,
  type PrivacyPolicyFormState,
} from "@/app/admin/privacy-policy-actions";

type Props = {
  bodyAr: string;
  bodyEn: string;
};

export function PrivacyPolicyForm({ bodyAr, bodyEn }: Props) {
  const uid = useId();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updatePrivacyPolicy,
    null as PrivacyPolicyFormState,
  );

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state?.ok, router]);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm">
        <label htmlFor={`${uid}-ar`} className="block text-sm font-bold text-on-surface">
          نص السياسة بالعربية
        </label>
        <p className="mt-1 text-sm text-on-surface-variant">
          اكتب السياسة كفقرات — كل سطر فارغ يبدأ فقرة جديدة في الصفحة العامة.
        </p>
        <textarea
          id={`${uid}-ar`}
          name="bodyAr"
          rows={16}
          defaultValue={bodyAr}
          maxLength={20000}
          className="mt-3 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary"
          placeholder="مثال: نلتزم في روائس لتأجير السيارات بحماية بياناتك الشخصية…"
        />
      </div>

      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm">
        <label htmlFor={`${uid}-en`} className="block text-sm font-bold text-on-surface">
          نص السياسة بالإنجليزية (اختياري)
        </label>
        <p className="mt-1 text-sm text-on-surface-variant">
          إن تركته فارغاً يُعرض النص العربي لزوار النسخة الإنجليزية.
        </p>
        <textarea
          id={`${uid}-en`}
          name="bodyEn"
          rows={16}
          defaultValue={bodyEn}
          maxLength={20000}
          dir="ltr"
          className="mt-3 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-start text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary"
          placeholder="Example: At Rawaes Car Rental we are committed to protecting your personal data…"
        />
      </div>

      {state?.ok ? (
        <p className="text-sm font-bold text-emerald-800" role="status">
          تم حفظ سياسة الخصوصية.
        </p>
      ) : null}
      {state?.ok === false && state.error ? (
        <p className="text-sm font-bold text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
      >
        {pending ? "جاري الحفظ…" : "حفظ"}
      </button>
    </form>
  );
}
