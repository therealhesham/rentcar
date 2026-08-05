"use client";

import { useActionState, useState } from "react";
import { updateSocialLinks } from "@/app/admin/social-links-actions";
import { SOCIAL_ICONS } from "@/components/home/SiteFooter";
import {
  SOCIAL_PLATFORM_LABELS,
  type SocialLinkItem,
  type SocialPlatformKey,
} from "@/lib/social-links";
import { Check, Link as LinkIcon, Globe, Sparkles } from "lucide-react";

export function SocialLinksEditForm({
  initialLinks,
}: {
  initialLinks: SocialLinkItem[];
}) {
  const [items, setItems] = useState<SocialLinkItem[]>(initialLinks);
  const [state, formAction, pending] = useActionState(updateSocialLinks, null);

  const handleToggle = (platform: SocialPlatformKey) => {
    setItems((prev) =>
      prev.map((item) =>
        item.platform === platform ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const handleUrlChange = (platform: SocialPlatformKey, url: string) => {
    setItems((prev) =>
      prev.map((item) => (item.platform === platform ? { ...item, url } : item))
    );
  };

  const handleLabelChange = (platform: SocialPlatformKey, label: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.platform === platform ? { ...item, label } : item
      )
    );
  };

  const activeCount = items.filter((i) => i.enabled && Boolean(i.url.trim())).length;

  return (
    <form action={formAction} className="grid gap-6">
      <input
        type="hidden"
        name="socialLinksJson"
        value={JSON.stringify(items)}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
        <div>
          <h2 className="text-base font-bold text-on-surface">
            إعدادات وسائل التواصل الاجتماعي
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            قم بتفعيل المنصات المطلوبة وإدخال الروابط لتعرض تلقائياً في فوتر الموقع الرئيسي.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary">
          <Sparkles className="size-3.5" aria-hidden />
          <span>{activeCount} منصات مفعلة وتظهر في الفوتر</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const IconComponent = SOCIAL_ICONS[item.platform];
          const platformName = SOCIAL_PLATFORM_LABELS[item.platform] || item.platform;

          return (
            <div
              key={item.platform}
              className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                item.enabled
                  ? "border-primary/40 bg-surface shadow-sm"
                  : "border-outline-variant/20 bg-surface-container-lowest/60 opacity-80"
              }`}
            >
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                        item.enabled
                          ? "bg-[#003749] text-white"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {IconComponent ? (
                        <IconComponent className="h-5 w-5" />
                      ) : (
                        <Globe className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface">{platformName}</h3>
                      <span className="text-[11px] text-on-surface-variant">
                        {item.enabled ? "مفعّل في الفوتر" : "معطّل"}
                      </span>
                    </div>
                  </div>

                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => handleToggle(item.platform)}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-outline-variant/40 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#003749] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none rtl:peer-checked:after:-translate-x-full"></div>
                  </label>
                </div>

                <div className="grid gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                      رابط الحساب / الصفحة (URL)
                    </label>
                    <div className="relative">
                      <LinkIcon
                        className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60"
                        aria-hidden
                      />
                      <input
                        type="url"
                        value={item.url}
                        onChange={(e) => handleUrlChange(item.platform, e.target.value)}
                        placeholder={`https://...`}
                        dir="ltr"
                        className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest py-2 pe-3 ps-9 text-xs font-medium text-on-surface outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-on-surface-variant">
                      العنوان التوضيحي (Label)
                    </label>
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handleLabelChange(item.platform, e.target.value)}
                      placeholder={platformName}
                      className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-all hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ روابط وسائل التواصل"}
        </button>

        {state?.ok ? (
          <p className="flex items-center gap-1.5 text-sm font-bold text-primary" role="status">
            <Check className="size-4" />
            تم حفظ روابط وسائل التواصل الاجتماعي بنجاح والتحديث في الفوتر!
          </p>
        ) : null}

        {state?.error ? (
          <p className="text-sm font-bold text-error" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
