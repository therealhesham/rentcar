"use client";

import { useActionState } from "react";
import { updateHomeHero } from "@/app/admin/home-hero-actions";
import { AdminImageField } from "@/components/admin/AdminImageField";

type Props = {
  currentLeftImageUrl: string;
  currentLeftAlt: string;
  currentRightImageUrl: string;
  currentRightAlt: string;
};

export function HomeHeroEditForm({
  currentLeftImageUrl,
  currentLeftAlt,
  currentRightImageUrl,
  currentRightAlt,
}: Props) {
  const [state, formAction, pending] = useActionState(updateHomeHero, null);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="grid gap-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <input type="hidden" name="currentImageLeft" value={currentLeftImageUrl} />
      <input type="hidden" name="currentImageRight" value={currentRightImageUrl} />

      <div>
        <h2 className="text-lg font-extrabold tracking-tight">صور الهيرو (الصفحة الرئيسية)</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          صورة على اليسار وصورة على اليمين مع نص في المنتصف. يمكن الاختيار من المعرض أو رفع صورة
          جديدة إلى مجلد «الصفحة الرئيسية (هيرو)» في Spaces. اترك الملف والمعرض فارغين للإبقاء على
          الصورة الحالية لكل جانب.
        </p>
      </div>

      <AdminImageField
        label="صورة اليسار (خارجية / معرض)"
        currentImageUrl={currentLeftImageUrl}
        galleryFieldName="galleryImageUrlLeft"
        fileFieldName="imageFileLeft"
        fileHelp="اترك الملف والمعرض فارغين للإبقاء على الصورة الحالية. بحد أقصى 5 ميجابايت."
      />

      <label className="text-sm font-medium">
        وصف صورة اليسار (alt)
        <input
          name="altLeft"
          required
          defaultValue={currentLeftAlt}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <AdminImageField
        label="صورة اليمين (معرض / داخلية)"
        currentImageUrl={currentRightImageUrl}
        galleryFieldName="galleryImageUrlRight"
        fileFieldName="imageFileRight"
        fileHelp="اترك الملف والمعرض فارغين للإبقاء على الصورة الحالية. بحد أقصى 5 ميجابايت."
      />

      <label className="text-sm font-medium">
        وصف صورة اليمين (alt)
        <input
          name="altRight"
          required
          defaultValue={currentRightAlt}
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
