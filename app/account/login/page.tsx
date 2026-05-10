"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginCustomer, type AuthFormState } from "@/app/account/actions";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";

export default function AccountLoginPage() {
  const [state, formAction, pending] = useActionState(loginCustomer, null as AuthFormState);

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f5] text-on-surface">
      <SiteNav active="home" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-28">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-lg">
          <h1 className="mb-2 text-2xl font-extrabold text-[#003749]">دخول العميل</h1>
          <p className="mb-6 text-sm text-on-surface-variant">
            سجّل الدخول لمتابعة حجوزاتك وإدارة بياناتك.
          </p>
          <form action={formAction} className="flex flex-col gap-4">
            <label className="text-sm font-bold text-on-surface-variant">
              البريد الإلكتروني
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-on-surface outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                dir="ltr"
              />
            </label>
            <label className="text-sm font-bold text-on-surface-variant">
              كلمة المرور
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#dbb878]/50"
              />
            </label>
            {state?.error ? (
              <p className="text-sm font-bold text-error" role="alert">
                {state.error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-[#003749] py-3 text-sm font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {pending ? "جاري الدخول…" : "دخول"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-on-surface-variant">
            ليس لديك حساب؟{" "}
            <Link href="/account/register" className="font-bold text-[#003749] underline underline-offset-2">
              إنشاء حساب
            </Link>
          </p>
          <p className="mt-3 text-center text-sm">
            <Link href="/" className="font-bold text-on-surface-variant hover:text-[#003749]">
              العودة للرئيسية
            </Link>
          </p>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
