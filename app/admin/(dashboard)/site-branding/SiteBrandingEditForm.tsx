"use client";

import { useActionState } from "react";
import { updateSiteBranding } from "@/app/admin/site-branding-actions";
import { AdminImageField } from "@/components/admin/AdminImageField";
import {
  SITE_BRANDING_SLOT_LABELS_AR,
  type SiteBranding,
  type SiteBrandingSlot,
} from "@/lib/site-branding";

const GROUPS: { title: string; hint: string; slots: SiteBrandingSlot[] }[] = [
  {
    title: "شعار الهيدر (Navbar)",
    hint: "يُعرض أعلى كل صفحات الموقع — تُختار النسخة تلقائياً حسب لغة الزائر.",
    slots: ["navAr", "navEn"],
  },
  {
    title: "شعار الفوتر",
    hint: "يُعرض أسفل كل صفحات الموقع — تُختار النسخة تلقائياً حسب لغة الزائر.",
    slots: ["footerAr", "footerEn"],
  },
  {
    title: "شعار السايدبار (القائمة الجانبية)",
    hint: "يُعرض في أعلى السايدبار (القائمة الجانبية) للوحة الإدارة وقوائم التنقل.",
    slots: ["sidebarLogo"],
  },
  {
    title: "الأيقونة وصورة المشاركة",
    hint: "أيقونة تبويب المتصفح، والصورة التي تظهر عند مشاركة رابط الموقع على واتساب وتويتر.",
    slots: ["favicon", "ogImage"],
  },
];

export function SiteBrandingEditForm({ current }: { current: SiteBranding }) {
  const [state, formAction, pending] = useActionState(updateSiteBranding, null);

  return (
    <form
      action={formAction}
      className="grid gap-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <p className="text-sm text-on-surface-variant">
        اختر من المعرض أو ارفع صورة جديدة لكل شعار — اترك الملف والمعرض فارغين للإبقاء على الشعار
        الحالي.
      </p>

      {GROUPS.map((group) => (
        <section
          key={group.title}
          className="border-t border-outline-variant/20 pt-6 first:border-t-0 first:pt-0"
        >
          <h2 className="text-base font-bold text-on-surface">{group.title}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">{group.hint}</p>

          <div className="mt-4 grid gap-6">
            {group.slots.map((slot) => (
              <div key={slot}>
                <input type="hidden" name={`currentImage_${slot}`} value={current[slot]} />
                <AdminImageField
                  label={SITE_BRANDING_SLOT_LABELS_AR[slot]}
                  currentImageUrl={current[slot]}
                  galleryFieldName={`galleryImageUrl_${slot}`}
                  fileFieldName={`imageFile_${slot}`}
                  fileHelp="اترك الملف والمعرض فارغين للإبقاء على الشعار الحالي. بحد أقصى 5 ميجابايت."
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ الشعارات"}
        </button>
      </div>

      {state?.ok ? (
        <p className="text-sm font-bold text-primary" role="status">
          تم حفظ شعارات الموقع بنجاح.
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
