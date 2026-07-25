"use client";

import { useActionState, useRef, useEffect } from "react";
import { Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { createBrand } from "@/app/admin/brand-actions";

const inputCls =
  "rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface outline-none ring-primary/30 focus:ring-2 placeholder:text-on-surface-variant/50";

export function BrandCreateForm() {
  const [state, formAction, pending] = useActionState(createBrand, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <div className="mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
      <h2 className="mb-4 text-lg font-extrabold tracking-tight">إضافة براند جديد</h2>

      {state?.ok && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          تمت إضافة البراند بنجاح.
        </div>
      )}

      {state && !state.ok && state.error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-800 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          {state.error}
        </div>
      )}

      <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          اسم البراند (عربي / رئيسي) *
          <input
            name="name"
            required
            placeholder="مثال: تويوتا"
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          اسم البراند (إنجليزي)
          <input
            name="nameEn"
            placeholder="مثال: Toyota"
            className={inputCls}
            dir="ltr"
          />
        </label>

        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="gradient-cta inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-extrabold text-white shadow-md transition-opacity disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {pending ? "جاري الإضافة..." : "إضافة البراند"}
          </button>
        </div>
      </form>
    </div>
  );
}
