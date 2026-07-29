"use client";

import { useActionState } from "react";
import { updateHomeHero } from "@/app/admin/home-hero-actions";
import { AdminImageField } from "@/components/admin/AdminImageField";

type Props = {
  currentImageUrl: string;
  currentImageAlt: string;
};

export function HomeHeroEditForm({ currentImageUrl, currentImageAlt }: Props) {
  const [state, formAction, pending] = useActionState(updateHomeHero, null);

  return (
    <form
      action={formAction}
      className="grid gap-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <input type="hidden" name="currentImage" value={currentImageUrl} />

      <div>
        <h2 className="text-lg font-extrabold tracking-tight">صورة الهيرو (الصفحة الرئيسية)</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          الخلفية الكاملة العرض خلف عنوان الصفحة الرئيسية ونموذج البحث. يمكن الاختيار من المعرض أو
          رفع صورة جديدة إلى مجلد «الصفحة الرئيسية (هيرو)» في Spaces. اترك الملف والمعرض فارغين
          للإبقاء على الصورة الحالية.
        </p>
      </div>

      <AdminImageField
        label="صورة الهيرو (خارجية / معرض)"
        currentImageUrl={currentImageUrl}
        galleryFieldName="galleryImageUrl"
        fileFieldName="imageFile"
        fileHelp="اترك الملف والمعرض فارغين للإبقاء على الصورة الحالية. بحد أقصى 5 ميجابايت."
      />

      <label className="text-sm font-medium">
        وصف الصورة (alt)
        <input
          name="imageAlt"
          required
          defaultValue={currentImageAlt}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ"}
        </button>
      </div>

      {state?.ok ? (
        <p className="text-sm font-bold text-primary" role="status">
          تم حفظ صورة الهيرو بنجاح.
        </p>
      ) : null}
      {state?.error ? (
        <p className="text-sm font-bold text-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
