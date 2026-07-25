"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Save } from "lucide-react";
import { updateBrand } from "@/app/admin/brand-actions";

type Props = {
  brand: {
    id: number;
    name: string;
    nameEn: string | null;
    _count: { models: number };
  };
};

const inputCls =
  "rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface outline-none ring-primary/30 focus:ring-2 placeholder:text-on-surface-variant/50";

export function BrandEditForm({ brand }: Props) {
  const [state, formAction, pending] = useActionState(updateBrand, null);

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
      {state?.ok && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          تم حفظ تعديلات البراند بنجاح.
        </div>
      )}

      {state && !state.ok && state.error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800 border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          {state.error}
        </div>
      )}

      <form action={formAction} className="grid gap-6">
        <input type="hidden" name="id" value={brand.id} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            اسم البراند (عربي / أساسي) *
            <input
              name="name"
              required
              defaultValue={brand.name}
              placeholder="مثال: تويوتا"
              className={inputCls}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            اسم البراند (إنجليزي)
            <input
              name="nameEn"
              defaultValue={brand.nameEn ?? ""}
              placeholder="مثال: Toyota"
              className={inputCls}
              dir="ltr"
            />
          </label>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/30">
          <Link
            href="/admin/brands"
            className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container"
          >
            إلغاء وعودة
          </Link>

          <button
            type="submit"
            disabled={pending}
            className="gradient-cta inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-extrabold text-white shadow-md transition-opacity disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {pending ? "جاري الحفظ..." : "حفظ التعديلات"}
          </button>
        </div>
      </form>
    </div>
  );
}
