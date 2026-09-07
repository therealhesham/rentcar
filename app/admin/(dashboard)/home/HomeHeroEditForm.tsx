"use client";

import { useActionState } from "react";
import { updateHomeHero } from "@/app/admin/home-hero-actions";
import { AdminImageField } from "@/components/admin/AdminImageField";
import { MAX_HOME_HERO_SLIDES, type HomeHeroSlide } from "@/lib/site-settings";

type Props = {
  currentSlides: HomeHeroSlide[];
};

export function HomeHeroEditForm({ currentSlides }: Props) {
  const [state, formAction, pending] = useActionState(updateHomeHero, null);

  const slots = Array.from(
    { length: MAX_HOME_HERO_SLIDES },
    (_, i) => currentSlides[i] ?? { imageUrl: "", mobileImageUrl: "", imageAlt: "" },
  );

  return (
    <form
      action={formAction}
      className="grid gap-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <div>
        <h2 className="text-lg font-extrabold tracking-tight">صور خلفية الهيرو (الصفحة الرئيسية)</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          الخلفية الكاملة العرض خلف عنوان الصفحة الرئيسية ونموذج البحث. يمكنك إضافة حتى{" "}
          {MAX_HOME_HERO_SLIDES} صور تتنقّل تلقائياً بانزلاق جانبي كل ٦ ثوانٍ (صورة واحدة = خلفية
          ثابتة بلا حركة). لكل شريحة صورة كمبيوتر وصورة جوال اختيارية تسقط على صورة الكمبيوتر إن
          تُركت فارغة. الشرائح الفارغة تُتجاهل، واترك الملف والمعرض فارغين للإبقاء على الصورة
          الحالية.
        </p>
      </div>

      {slots.map((slide, i) => (
        <fieldset key={i} className="rounded-xl border border-outline-variant/40 p-4">
          <legend className="px-2 text-sm font-extrabold text-[#003749]">
            الصورة {i + 1}
            {i === 0 ? " (الأولى — تظهر عند فتح الصفحة)" : ""}
          </legend>

          <input type="hidden" name={`currentImage_${i}`} value={slide.imageUrl} />

          <AdminImageField
            label="صورة الكمبيوتر (رفع / معرض)"
            currentImageUrl={slide.imageUrl || null}
            galleryFieldName={`galleryImageUrl_${i}`}
            fileFieldName={`imageFile_${i}`}
            fileHelp="بحد أقصى 5 ميجابايت. يُنصح بصورة عريضة 1920px+ لتغطية الشاشة."
          />

          <div className="mt-6 rounded-lg border border-dashed border-outline-variant/60 p-4">
            <input
              type="hidden"
              name={`currentImage_mobile_${i}`}
              value={slide.mobileImageUrl}
            />

            <AdminImageField
              label="صورة الجوال (اختيارية)"
              currentImageUrl={slide.mobileImageUrl || null}
              galleryFieldName={`galleryImageUrl_mobile_${i}`}
              fileFieldName={`imageFile_mobile_${i}`}
              fileHelp="تظهر على الشاشات أقل من 640px. اتركها فارغة لاستخدام صورة الكمبيوتر نفسها. يُنصح بصورة طولية."
            />

            {slide.mobileImageUrl ? (
              <label className="mt-4 flex items-center gap-2 text-sm font-medium text-error">
                <input
                  type="checkbox"
                  name={`removeMobile_${i}`}
                  className="size-4 accent-current"
                />
                حذف صورة الجوال (الرجوع لصورة الكمبيوتر)
              </label>
            ) : null}
          </div>

          <label className="mt-4 block text-sm font-medium">
            وصف الصورة (alt)
            <input
              name={`imageAlt_${i}`}
              defaultValue={slide.imageAlt}
              placeholder="سيارة فاخرة أمام معرض روائس لتأجير السيارات"
              className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
            />
          </label>

          {slide.imageUrl ? (
            <label className="mt-4 flex items-center gap-2 text-sm font-medium text-error">
              <input type="checkbox" name={`remove_${i}`} className="size-4 accent-current" />
              حذف هذه الصورة عند الحفظ
            </label>
          ) : null}
        </fieldset>
      ))}

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
          تم حفظ صور الهيرو بنجاح.
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
