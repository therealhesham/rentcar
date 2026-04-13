"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAdmin } from "@/app/admin/actions";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(loginAdmin, null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-16 text-on-surface">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface-container-low p-8 shadow-lg">
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight">
          دخول الإدارة
        </h1>
        <p className="mb-8 text-sm text-on-surface-variant">
          أدخل كلمة المرور المعرّفة في{" "}
          <code className="rounded bg-surface-container px-1 py-0.5 text-xs">
            ADMIN_PASSWORD
          </code>
        </p>
        <form action={formAction} className="flex flex-col gap-4">
          <label className="text-sm font-medium">
            كلمة المرور
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface outline-none ring-primary/30 focus:ring-2"
            />
          </label>
          {state?.error ? (
            <p className="text-sm font-medium text-error" role="alert">
              {state.error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="gradient-cta rounded-xl py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60"
          >
            {pending ? "جاري التحقق…" : "دخول"}
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-on-surface-variant">
          <Link href="/" className="font-bold text-primary hover:underline">
            العودة للموقع
          </Link>
        </p>
      </div>
    </div>
  );
}
