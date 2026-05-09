"use client";

import { useActionState } from "react";
import { updatePromoBanner } from "@/app/admin/promo-banner-actions";
import { AdminImageField } from "@/components/admin/AdminImageField";
import type { PromoBannerSlide } from "@/lib/site-settings";

const MAX_SLIDES = 5;

type Props = {
  currentSlides: PromoBannerSlide[];
};

export function PromoBannerEditForm({ currentSlides }: Props) {
  const [state, formAction, pending] = useActionState(updatePromoBanner, null);

  const slots = Array.from({ length: MAX_SLIDES }, (_, i) => currentSlides[i] ?? { imageUrl: "", linkUrl: "" });

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="grid gap-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <div>
        <h2 className="text-lg font-extrabold tracking-tight">شرائح البانر الترويجي</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          يمكنك إضافة حتى {MAX_SLIDES} شرائح. الشرائح الفارغة (بلا صورة) تُتجاهل تلقائياً.
          الصور تظهر بتسلسلها في carousel أوتوماتيكي فوق قسم «خدماتنا».
        </p>
      </div>

      {slots.map((slide, i) => (
        <fieldset
          key={i}
          className="rounded-xl border border-outline-variant/40 p-4"
        >
          <legend className="px-2 text-sm font-extrabold text-[#003749]">
            الشريحة {i + 1}
          </legend>

          <input type="hidden" name={`currentImage_${i}`} value={slide.imageUrl} />

          <AdminImageField
            label="الصورة"
            currentImageUrl={slide.imageUrl || null}
            galleryFieldName={`galleryImageUrl_${i}`}
            fileFieldName={`imageFile_${i}`}
            fileHelp="بحد أقصى 5 ميجابايت — JPEG أو PNG أو WebP. يُنصح بالعرض 1200px+"
          />

          <label className="mt-4 block text-sm font-medium">
            رابط النقر (اختياري)
            <input
              name={`linkUrl_${i}`}
              type="url"
              defaultValue={slide.linkUrl}
              placeholder="https://..."
              className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
            />
          </label>
        </fieldset>
      ))}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ الشرائح"}
        </button>
      </div>

      {state?.ok && (
        <p className="text-sm font-bold text-primary" role="status">
          تم حفظ البانر الترويجي بنجاح.
        </p>
      )}
      {state?.error && (
        <p className="text-sm font-bold text-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
