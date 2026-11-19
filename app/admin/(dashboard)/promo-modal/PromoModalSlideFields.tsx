"use client";

import { useMemo, useState } from "react";
import { AdminImageField } from "@/components/admin/AdminImageField";

export type PromoModalCarOption = {
  id: number;
  brand: string;
  label: string;
};

type LinkMode = "none" | "car" | "custom";

/** يتعرّف على رابط صفحة سيارة محفوظ سابقاً (نسبي أو كامل، بلغة أو بدون). */
const CAR_LINK_RE = /^(?:https?:\/\/[^/]+)?(?:\/(?:ar|en))?\/fleet\/car\/(\d+)\/?$/;

export function buildCarLink(modelId: number): string {
  return `/fleet/car/${modelId}`;
}

function initialLinkState(linkUrl: string, cars: PromoModalCarOption[]) {
  const trimmed = linkUrl.trim();
  if (!trimmed) return { mode: "none" as LinkMode, carId: "", customUrl: "" };
  const m = CAR_LINK_RE.exec(trimmed);
  if (m && cars.some((c) => c.id === Number(m[1]))) {
    return { mode: "car" as LinkMode, carId: m[1], customUrl: "" };
  }
  return { mode: "custom" as LinkMode, carId: "", customUrl: trimmed };
}

type Props = {
  index: number;
  imageUrl: string;
  linkUrl: string;
  cars: PromoModalCarOption[];
};

export function PromoModalSlideFields({ index: i, imageUrl, linkUrl, cars }: Props) {
  const [currentImage, setCurrentImage] = useState(imageUrl);
  const initial = useMemo(() => initialLinkState(linkUrl, cars), [linkUrl, cars]);
  const [mode, setMode] = useState<LinkMode>(initial.mode);
  const [carId, setCarId] = useState(initial.carId);
  const [customUrl, setCustomUrl] = useState(initial.customUrl);

  const carsByBrand = useMemo(() => {
    const groups = new Map<string, PromoModalCarOption[]>();
    for (const c of cars) {
      const list = groups.get(c.brand) ?? [];
      list.push(c);
      groups.set(c.brand, list);
    }
    return [...groups.entries()];
  }, [cars]);

  const finalLink =
    mode === "car" && carId ? buildCarLink(Number(carId)) : mode === "custom" ? customUrl.trim() : "";

  const inputCls =
    "mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2";

  return (
    <fieldset className="rounded-xl border border-outline-variant/40 p-4">
      <legend className="px-2 text-sm font-extrabold text-[#003749]">الصورة {i + 1}</legend>

      <input type="hidden" name={`currentImage_${i}`} value={currentImage} />
      <input type="hidden" name={`linkUrl_${i}`} value={finalLink} />

      <AdminImageField
        label="الصورة"
        currentImageUrl={currentImage || null}
        galleryFieldName={`galleryImageUrl_${i}`}
        fileFieldName={`imageFile_${i}`}
        fileHelp="بحد أقصى 5 ميجابايت — JPEG أو PNG أو WebP أو SVG. يُنصح بصورة رأسية أو مربعة بعرض 800px+"
        onClear={() => setCurrentImage("")}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
        <label className="block text-sm font-medium">
          عند الضغط على الصورة
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as LinkMode)}
            className={inputCls}
          >
            <option value="none">بدون رابط</option>
            <option value="car">فتح صفحة سيارة</option>
            <option value="custom">رابط مخصص</option>
          </select>
        </label>

        {mode === "car" && (
          <label className="block text-sm font-medium">
            اختر السيارة (الموديل)
            <select value={carId} onChange={(e) => setCarId(e.target.value)} className={inputCls}>
              <option value="">— اختر موديل —</option>
              {carsByBrand.map(([brand, list]) => (
                <optgroup key={brand} label={brand}>
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}

        {mode === "custom" && (
          <label className="block text-sm font-medium">
            الرابط
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://... أو /fleet"
              className={inputCls}
              dir="ltr"
            />
          </label>
        )}
      </div>

      {finalLink && (
        <p className="mt-2 text-xs text-on-surface-variant">
          الرابط الناتج:{" "}
          <span dir="ltr" className="font-mono font-bold text-on-surface">
            {finalLink}
          </span>
        </p>
      )}
    </fieldset>
  );
}
