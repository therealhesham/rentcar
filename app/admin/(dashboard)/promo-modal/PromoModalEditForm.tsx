"use client";

import { useActionState } from "react";
import { updatePromoModal } from "@/app/admin/promo-modal-actions";
import {
  MAX_PROMO_MODAL_COOLDOWN_MINUTES,
  MIN_PROMO_MODAL_COOLDOWN_MINUTES,
  type PromoModalSettings,
} from "@/lib/site-settings";
import { PromoModalSlideFields, type PromoModalCarOption } from "./PromoModalSlideFields";

const MAX_SLIDES = 20;

type Props = {
  settings: PromoModalSettings;
  cars: PromoModalCarOption[];
};

export function PromoModalEditForm({ settings, cars }: Props) {
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
        <PromoModalSlideFields
          key={`${i}:${slide.imageUrl}:${slide.linkUrl}`}
          index={i}
          imageUrl={slide.imageUrl}
          linkUrl={slide.linkUrl}
          cars={cars}
        />
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
