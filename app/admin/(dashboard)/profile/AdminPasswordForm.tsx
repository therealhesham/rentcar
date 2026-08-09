"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateMyAdminPassword } from "@/app/admin/admin-profile-actions";

const FIELD_CLASS =
  "mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2 disabled:opacity-60";

/** مدير النظام البيئي بلا صف في AdminEmployee — الحفظ غير ممكن له */
export function AdminPasswordForm({ editable }: { editable: boolean }) {
  const [state, formAction, pending] = useActionState(updateMyAdminPassword, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="max-w-xl space-y-5 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <h2 className="text-lg font-extrabold tracking-tight">تغيير كلمة المرور</h2>

      <label className="block text-sm font-medium">
        كلمة المرور الحالية
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          disabled={!editable}
          className={FIELD_CLASS}
        />
      </label>

      <label className="block text-sm font-medium">
        كلمة المرور الجديدة
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          disabled={!editable}
          className={FIELD_CLASS}
        />
        <span className="mt-1 block text-xs font-normal text-on-surface-variant">
          6 أحرف على الأقل.
        </span>
      </label>

      <label className="block text-sm font-medium">
        تأكيد كلمة المرور الجديدة
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          disabled={!editable}
          className={FIELD_CLASS}
        />
      </label>

      {state?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg bg-primary-container/30 px-3 py-2 text-sm font-bold text-on-primary-container">
          تم تغيير كلمة المرور. استخدمها في تسجيل الدخول القادم.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !editable}
        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity disabled:opacity-60"
      >
        {pending ? "جاري الحفظ…" : "حفظ كلمة المرور"}
      </button>
    </form>
  );
}
