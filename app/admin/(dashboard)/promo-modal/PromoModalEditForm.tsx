"use client";

import { useActionState } from "react";
import { updatePromoModal } from "@/app/admin/promo-modal-actions";
import { AdminImageField } from "@/components/admin/AdminImageField";
import {
  MAX_PROMO_MODAL_COOLDOWN_MINUTES,
  MIN_PROMO_MODAL_COOLDOWN_MINUTES,
  type PromoModalSettings,
} from "@/lib/site-settings";

const MAX_SLIDES = 20;

type Props = {
  settings: PromoModalSettings;
};

export function PromoModalEditForm({ settings }: Props) {
  const [state, formAction, pending] = useActionState(updatePromoModal, null);

  const slots = Array.from(
    { length: MAX_SLIDES },
    (_, i) => settings.slides[i] ?? { imageUrl: "", linkUrl: "" },
  );

  return (
    <form
      action={formAction}
      className="grid gap-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <div>
        <h2 className="text-lg font-extrabold tracking-tight">إعدادات النافذة</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          عند التفعيل تفتح النافذة تلقائياً بعد لحظة من دخول الصفحة الرئيسية. لا تظهر
          للزائر نفسه مرة أخرى قبل انقضاء فترة التهدئة، وعند ظهورها التالي تعرض الصورة
          التي تلي الأخيرة بالتناوب (النافذة الآن كاروزال يعرض كل الصور).
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-outline-variant/40 p-4">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={settings.enabled}
          className="mt-1 size-4 accent-[#003749]"
        />
        <span>
          <span className="block text-sm font-bold">تفعيل النافذة الترويجية</span>
          <span className="mt-1 block text-xs text-on-surface-variant">
            لن تُفعَّل إن لم تُضَف صورة واحدة على الأقل.
          </span>
        </span>
      </label>

      <label className="block text-sm font-medium">
        فترة التهدئة (بالدقائق)
        <input
          name="cooldownMinutes"
          type="number"
          min={MIN_PROMO_MODAL_COOLDOWN_MINUTES}
          max={MAX_PROMO_MODAL_COOLDOWN_MINUTES}
          step={1}
          defaultValue={settings.cooldownMinutes}
          className="mt-2 w-full max-w-[200px] rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
        <span className="mt-1 block text-xs text-on-surface-variant">
          المدة التي يجب أن تمر قبل أن تظهر النافذة للزائر نفسه مجدداً (الافتراضي ٣٠ دقيقة).
        </span>
      </label>

      <div>
        <h2 className="text-lg font-extrabold tracking-tight">صور النافذة</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          يمكنك إضافة حتى {MAX_SLIDES} صورة. الخانات الفارغة (بلا صورة) تُتجاهل تلقائياً.
        </p>
      </div>

      {slots.map((slide, i) => (
        <fieldset key={i} className="rounded-xl border border-outline-variant/40 p-4">
          <legend className="px-2 text-sm font-extrabold text-[#003749]">
            الصورة {i + 1}
          </legend>

          <input type="hidden" name={`currentImage_${i}`} value={slide.imageUrl} />

          <AdminImageField
            label="الصورة"
            currentImageUrl={slide.imageUrl || null}
            galleryFieldName={`galleryImageUrl_${i}`}
            fileFieldName={`imageFile_${i}`}
            fileHelp="بحد أقصى 5 ميجابايت — JPEG أو PNG أو WebP أو SVG. يُنصح بصورة رأسية أو مربعة بعرض 800px+"
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
          {pending ? "جاري الحفظ…" : "حفظ الإعدادات"}
        </button>
      </div>

      {state?.ok && (
        <p className="text-sm font-bold text-primary" role="status">
          تم حفظ النافذة الترويجية بنجاح.
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
