"use client";

import { Suspense, useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield } from "lucide-react";
import { loginAdmin, type AdminLoginState } from "@/app/admin/actions";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState<AdminLoginState | null, FormData>(
    loginAdmin,
    null,
  );

  useEffect(() => {
    if (!state?.ok) return;
    const next = searchParams.get("next");
    const target =
      next && next.startsWith("/admin") && !next.startsWith("/admin/login")
        ? next
        : "/admin";
    router.replace(target);
    router.refresh();
  }, [state, router, searchParams]);

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-outline-variant/25 bg-white shadow-[0_24px_60px_-20px_rgba(15,61,71,0.15)]">
      <div className="border-b border-outline-variant/15 bg-[#003749] px-8 py-6 text-center text-white">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#e8c084]/20">
          <Shield className="size-6 text-[#e8c084]" aria-hidden />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight">دخول الإدارة</h1>
        <p className="mt-1 text-sm text-white/65">روائس لتأجير السيارات</p>
      </div>

      <div className="p-8">
        <p className="mb-6 text-sm leading-relaxed text-on-surface-variant">
          سجّل دخولك بحساب الموظف. مدير النظام يرى كل الفروع؛ موظف الفرع يرى بيانات فرعه فقط.
        </p>
        <form action={formAction} className="flex flex-col gap-4">
          <label className="block text-sm font-bold text-on-surface">
            البريد الإلكتروني
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              dir="ltr"
              className="mt-2 w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 text-on-surface outline-none transition-[box-shadow,border-color] focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block text-sm font-bold text-on-surface">
            كلمة المرور
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 text-on-surface outline-none transition-[box-shadow,border-color] focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          {state && !state.ok ? (
            <p
              className="rounded-xl bg-error-container/40 px-3 py-2 text-sm font-bold text-error"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="gradient-cta rounded-xl py-3 text-sm font-extrabold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "جاري التحقق…" : "دخول"}
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-on-surface-variant">
          <Link href="/" className="font-bold text-primary hover:underline">
            العودة للموقع العام
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f1ee] px-6 py-16 text-on-surface">
      <Suspense
        fallback={
          <div className="h-96 w-full max-w-md animate-pulse rounded-2xl bg-white/80" />
        }
      >
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
