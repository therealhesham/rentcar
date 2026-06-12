"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerCustomer, type AuthFormState } from "@/app/[locale]/account/actions";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";

export default function AccountRegisterPage() {
  const [state, formAction, pending] = useActionState(registerCustomer, null as AuthFormState);

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f5] text-on-surface">
      <SiteNav active="home" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-28">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-lg">
          <h1 className="mb-2 text-2xl font-extrabold text-[#003749]">إنشاء حساب</h1>
          <p className="mb-6 text-sm text-on-surface-variant">
            أنشئ حساباً لربط حجوزاتك بنفس الجوال المستخدم عند الحجز.
          </p>
          <form action={formAction} className="flex flex-col gap-4">
            <label className="text-sm font-bold text-on-surface-variant">
              الاسم الكامل
              <input
                name="name"
                type="text"
                required
                minLength={2}
                autoComplete="name"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                dir="rtl"
              />
            </label>
            <label className="text-sm font-bold text-on-surface-variant">
              البريد الإلكتروني
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                dir="ltr"
              />
            </label>
            <label className="text-sm font-bold text-on-surface-variant">
              الجوال
              <div className="mt-1.5 flex overflow-hidden rounded-xl border border-neutral-200" dir="ltr">
                <span className="flex items-center border-e border-neutral-200 px-3 text-sm font-bold">
                  +966
                </span>
                <input
                  name="phone"
                  type="tel"
                  required
                  pattern="5[0-9]{8}"
                  maxLength={9}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="5XXXXXXXX"
                  className="min-w-0 flex-1 px-4 py-3 outline-none focus:ring-2 focus:ring-[#dbb878]/50"
                />
              </div>
            </label>
            <label className="text-sm font-bold text-on-surface-variant">
              كلمة المرور
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-[#dbb878]/50"
              />
            </label>
            <label className="text-sm font-bold text-on-surface-variant">
              تأكيد كلمة المرور
              <input
                name="passwordConfirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:ring-2 focus:ring-[#dbb878]/50"
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
              {pending ? "جاري التسجيل…" : "إنشاء الحساب"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-on-surface-variant">
            لديك حساب بالفعل؟{" "}
            <Link href="/account/login" className="font-bold text-[#003749] underline underline-offset-2">
              دخول
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
