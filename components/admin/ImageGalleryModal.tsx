"use client";

import { ArrowRight, FolderOpen, Loader2, X } from "lucide-react";
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

type FolderMeta = { id: string; label: string };

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
  const [folders, setFolders] = useState<FolderMeta[]>([]);
  /** المجلد الحالي داخل التصفح — null = شاشة اختيار المجلدات */
  const [browseFolder, setBrowseFolder] = useState<string | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/gallery", { credentials: "same-origin" });
      const data = (await res.json()) as {
        folders?: FolderMeta[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "فشل التحميل.");
      }
      setFolders(data.folders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل التحميل.");
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  const loadImages = useCallback(
    async (folder: string, cursor?: string, append = false) => {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams({ folder });
        if (cursor) {
          params.set("cursor", cursor);
        }
        const res = await fetch(`/api/admin/gallery?${params.toString()}`, {
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
    },
    [],
  );

  useEffect(() => {
    if (!open) {
      setSelectedUrl(null);
      setBrowseFolder(null);
      setItems([]);
      setNextCursor(undefined);
      setFolders([]);
      setShowNewFolder(false);
      setNewLabel("");
      return;
    }
    void loadFolders();
  }, [open, loadFolders]);

  const submitNewFolder = async () => {
    setCreatingFolder(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/gallery/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ label: newLabel }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "تعذّر إنشاء المجلد.");
      }
      setNewLabel("");
      setShowNewFolder(false);
      await loadFolders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر إنشاء المجلد.");
    } finally {
      setCreatingFolder(false);
    }
  };

  const enterFolder = useCallback(
    (folderId: string) => {
      setBrowseFolder(folderId);
      setItems([]);
      setNextCursor(undefined);
      setSelectedUrl(null);
      void loadImages(folderId);
    },
    [loadImages],
  );

  const backToFolders = useCallback(() => {
    setBrowseFolder(null);
    setItems([]);
    setNextCursor(undefined);
    setSelectedUrl(null);
  }, []);

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
    if (!browseFolder) {
      setError("اختر مجلداً أولاً ثم أضف الصورة.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("folder", browseFolder);
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

  const folderLabel =
    browseFolder && folders.find((f) => f.id === browseFolder)?.label;

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
        className="relative z-10 flex h-[min(94vh,960px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest editorial-shadow"
      >
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {browseFolder ? (
              <button
                type="button"
                onClick={backToFolders}
                className="inline-flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-2 text-sm font-bold text-primary hover:bg-surface-container"
              >
                <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
                المجلدات
              </button>
            ) : null}
            <h2
              id={panelId}
              className="min-w-0 text-lg font-extrabold tracking-tight"
            >
              {title}
              {folderLabel ? (
                <span className="ms-2 text-base font-bold text-on-surface-variant">
                  — {folderLabel}
                </span>
              ) : null}
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!browseFolder ? (
              <button
                type="button"
                onClick={() => {
                  setShowNewFolder((v) => !v);
                  setError(null);
                }}
                className="rounded-xl border border-primary/40 bg-primary-container/40 px-3 py-2 text-sm font-bold text-primary hover:bg-primary-container/60"
              >
                {showNewFolder ? "إغلاق النموذج" : "إضافة مجلد"}
              </button>
            ) : null}
            <label
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm font-bold transition-colors ${
                browseFolder
                  ? "text-primary hover:bg-surface-container-high"
                  : "cursor-not-allowed opacity-50"
              }`}
              title={
                browseFolder ? undefined : "افتح مجلداً أولاً لتحديد مكان الرفع"
              }
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={uploading || !browseFolder}
                onChange={(e) => void handleUpload(e.target.files)}
              />
              {uploading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <span className="text-lg font-medium leading-none" aria-hidden>
                  +
                </span>
              )}
              <span>إضافة صورة</span>
            </label>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p
              className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {!browseFolder ? (
            loadingFolders ? (
              <div className="flex justify-center py-16">
                <Loader2
                  className="h-10 w-10 animate-spin text-primary"
                  aria-label="جاري التحميل"
                />
              </div>
            ) : (
              <>
                {showNewFolder ? (
                  <div className="mb-6 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4">
                    <p className="text-sm font-bold text-on-surface">مجلد جديد</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      اكتب اسماً للمجلد فقط — يُنشأ تلقائياً ويمكنك رفع الصور وإعادة استخدامها.
                    </p>
                    <label className="mt-4 block text-sm font-medium">
                      اسم المجلد
                      <input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="مثال: عروض الصيف"
                        className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface outline-none ring-primary/30 focus:ring-2"
                      />
                    </label>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={creatingFolder || !newLabel.trim()}
                        onClick={() => void submitNewFolder()}
                        className="gradient-cta rounded-xl px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {creatingFolder ? "جاري الحفظ…" : "حفظ المجلد"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {folders.length === 0 ? (
                  <p className="py-12 text-center text-sm text-on-surface-variant">
                    لا توجد مجلدات. استخدم «إضافة مجلد» أعلاه أو نفّذ{" "}
                    <code className="rounded bg-surface-container px-1 text-xs">
                      npx prisma db seed
                    </code>{" "}
                    لإدراج المجلدات الافتراضية.
                  </p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {folders.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => enterFolder(f.id)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-5 text-start transition-colors hover:border-primary/40 hover:bg-surface-container"
                        >
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container/50 text-primary">
                            <FolderOpen className="h-6 w-6" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-extrabold">{f.label}</span>
                            <span className="mt-0.5 block text-xs text-on-surface-variant">
                              عرض الصور
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )
          ) : loading ? (
            <div className="flex justify-center py-16">
              <Loader2
                className="h-10 w-10 animate-spin text-primary"
                aria-label="جاري التحميل"
              />
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-on-surface-variant">
              لا توجد صور في هذا المجلد بعد. استخدم «إضافة صورة» أعلاه لرفع صورة هنا
              لتُخزَّن تحت نفس المجلد وتُعاد استخدامها لاحقاً.
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

          {browseFolder && nextCursor ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() =>
                  void loadImages(browseFolder, nextCursor, true)
                }
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-primary hover:bg-surface-container disabled:opacity-50"
              >
                {loadingMore ? "جاري التحميل…" : "تحميل المزيد (10)"}
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
