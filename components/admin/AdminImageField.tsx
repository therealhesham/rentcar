"use client";

import { ImageIcon } from "lucide-react";
import { useId, useState } from "react";
import { ImageGalleryModal } from "@/components/admin/ImageGalleryModal";

type AdminImageFieldProps = {
  label: string;
  /** نص مساعد تحت حقل الملف */
  fileHelp?: string;
  /** عند التعديل: رابط الصورة الحالية */
  currentImageUrl?: string | null;
  /** هل يجب توفير صورة (رفع أو معرض) — التحقق النهائي على الخادم */
  required?: boolean;
  /** إظهار حقل رفع الملف */
  showFileInput?: boolean;
};

export function AdminImageField({
  label,
  fileHelp = "بحد أقصى 5 ميجابايت — JPEG أو PNG أو WebP أو GIF.",
  currentImageUrl,
  required = false,
  showFileInput = true,
}: AdminImageFieldProps) {
  const id = useId();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryUrl, setGalleryUrl] = useState("");
  const [fileReset, setFileReset] = useState(0);

  const preview = galleryUrl || currentImageUrl || null;

  return (
    <div className="md:col-span-2">
      <input type="hidden" name="galleryImageUrl" value={galleryUrl} />

      <p className="text-sm font-medium">{label}</p>

      {preview ? (
        <div className="relative mt-2 aspect-[16/9] max-w-[280px] overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm font-bold text-primary hover:bg-surface-container"
        >
          <ImageIcon className="h-4 w-4" aria-hidden />
          اختيار من المعرض
        </button>
        {galleryUrl ? (
          <button
            type="button"
            onClick={() => {
              setGalleryUrl("");
              setFileReset((n) => n + 1);
            }}
            className="text-sm font-bold text-error hover:underline"
          >
            إزالة اختيار المعرض
          </button>
        ) : null}
      </div>

      {showFileInput ? (
        <label className="mt-4 block text-sm font-medium">
          رفع ملف من الجهاز {required && !galleryUrl ? "(مطلوب)" : "(اختياري)"}
          <input
            key={fileReset}
            name="imageFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            required={Boolean(required && !galleryUrl)}
            onChange={() => {
              setGalleryUrl("");
            }}
            className="mt-2 block w-full text-sm text-on-surface file:me-4 file:rounded-lg file:border-0 file:bg-primary-container file:px-4 file:py-2 file:text-sm file:font-bold file:text-on-primary-container"
          />
          <span id={`${id}-help`} className="mt-1 block text-xs text-on-surface-variant">
            {fileHelp}
          </span>
        </label>
      ) : null}

      <ImageGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={(url) => {
          setGalleryUrl(url);
          setFileReset((n) => n + 1);
        }}
      />
    </div>
  );
}
