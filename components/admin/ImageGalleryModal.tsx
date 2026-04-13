"use client";

import { Loader2, Upload, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type GalleryItem = {
  key: string;
  url: string;
  lastModified?: string;
};

type ImageGalleryModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  title?: string;
};

export function ImageGalleryModal({
  open,
  onClose,
  onSelect,
  title = "معرض الصور",
}: ImageGalleryModalProps) {
  const panelId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const loadPage = useCallback(async (cursor?: string, append = false) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const res = await fetch(`/api/admin/gallery${q}`, {
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        items?: GalleryItem[];
        nextCursor?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "فشل التحميل.");
      }
      const batch = data.items ?? [];
      setItems((prev) => (append ? [...prev, ...batch] : batch));
      setNextCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل التحميل.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setSelectedUrl(null);
      return;
    }
    setItems([]);
    setNextCursor(undefined);
    void loadPage();
  }, [open, loadPage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleUpload = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/gallery", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "فشل الرفع.");
      }
      if (data.url) {
        setItems((prev) => [
          {
            key: data.url!,
            url: data.url!,
          },
          ...prev,
        ]);
        setSelectedUrl(data.url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الرفع.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onBackdropKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="إغلاق"
        className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={panelId}
        tabIndex={-1}
        onKeyDown={onBackdropKeyDown}
        className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest editorial-shadow"
      >
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 px-5 py-4">
          <h2 id={panelId} className="text-lg font-extrabold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="border-b border-outline-variant/20 px-5 py-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant/60 bg-surface-container/50 px-4 py-6 transition-colors hover:border-primary/50 hover:bg-surface-container">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => void handleUpload(e.target.files)}
            />
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <Upload className="h-8 w-8 text-primary" aria-hidden />
            )}
            <span className="text-sm font-bold text-on-surface">
              إسقاط صورة هنا أو اضغط للرفع
            </span>
            <span className="text-xs text-on-surface-variant">
              تُحفظ في المعرض على Spaces — بحد أقصى 5 ميجابايت
            </span>
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-error" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-label="جاري التحميل" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-on-surface-variant">
              لا توجد صور بعد. ارفع صورة أعلاه لتظهر هنا.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((it) => {
                const active = selectedUrl === it.url;
                return (
                  <li key={it.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedUrl(it.url)}
                      className={`group relative w-full overflow-hidden rounded-xl border-2 bg-surface-container transition-all ${
                        active
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent hover:border-outline-variant"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={it.url}
                        alt=""
                        className="aspect-square w-full object-cover"
                      />
                      <span className="sr-only">اختيار الصورة</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {nextCursor ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadPage(nextCursor, true)}
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-primary hover:bg-surface-container disabled:opacity-50"
              >
                {loadingMore ? "جاري التحميل…" : "تحميل المزيد"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline-variant/30 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!selectedUrl}
            onClick={() => {
              if (selectedUrl) {
                onSelect(selectedUrl);
                onClose();
              }
            }}
            className="gradient-cta rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            استخدام الصورة
          </button>
        </div>
      </div>
    </div>
  );
}
