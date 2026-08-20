"use client";

import { useActionState } from "react";
import { updateKycDocRequirements } from "@/app/admin/kyc-doc-requirements-actions";
import type { KycDocRequirementLevel, KycDocRequirements } from "@/lib/kyc-doc-requirements";

type Props = {
  flags: KycDocRequirements;
};

const LEVEL_OPTIONS: { value: KycDocRequirementLevel; label: string; hint: string }[] = [
  { value: "REQUIRED", label: "إلزامي", hint: "لا يمكن إرسال الحجز بدون رفع الصورة." },
  { value: "OPTIONAL", label: "اختياري", hint: "الحقل يظهر لكن رفع الصورة ليس شرطاً لإتمام الحجز." },
  { value: "HIDDEN", label: "مخفي", hint: "الحقل يختفي بالكامل عن العميل ولا يُطلب منه إطلاقاً." },
];

const FIELDS: { key: keyof KycDocRequirements; label: string; hint: string }[] = [
  { key: "idImage", label: "صورة الهوية أو الجواز", hint: "الافتراضي: اختياري." },
  { key: "licenseImage", label: "صورة رخصة القيادة", hint: "الافتراضي: إلزامي." },
];

export function KycDocRequirementsForm({ flags }: Props) {
  const [state, formAction, pending] = useActionState(updateKycDocRequirements, null);

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      {FIELDS.map(({ key, label, hint }) => (
        <fieldset key={key} className="space-y-3">
          <legend className="text-base font-extrabold text-on-surface">{label}</legend>
          <p className="text-sm text-on-surface-variant">{hint}</p>
          <ul className="space-y-2">
            {LEVEL_OPTIONS.map((opt) => (
              <li key={opt.value}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 hover:border-outline-variant">
                  <input
                    type="radio"
                    name={key}
                    value={opt.value}
                    defaultChecked={flags[key] === opt.value}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>
                    <span className="block font-bold text-on-surface">{opt.label}</span>
                    <span className="mt-0.5 block text-xs text-on-surface-variant">{opt.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}

      {state?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">{state.error}</p>
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
