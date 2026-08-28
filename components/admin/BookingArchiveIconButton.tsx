"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Check, Loader2, X } from "lucide-react";
import { setBookingArchived } from "@/app/admin/booking-archive-actions";

/**
 * أرشفة/إرجاع بأيقونة مفردة — تحلّ محلّ قائمة الإجراءات في الحجوزات الملغاة
 * والمرفوضة، إذ تُخفى القائمة عنها بينما هي أولى ما يُؤرشف.
 *
 * الأرشفة تمرّ بتأكيد داخل الصف (الأيقونة تتحوّل إلى ✓/✕) لأنها تُخفي الحجز من
 * كل الأرقام؛ الإرجاع بضغطة واحدة لأنه لا يخفي شيئاً.
 */
export function BookingArchiveIconButton({
  bookingId,
  isHidden,
}: {
  bookingId: number;
  isHidden: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (archived: boolean) => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("bookingId", String(bookingId));
      fd.set("archived", String(archived));
      const result = await setBookingArchived(null, fd);
      if (!result.ok) setError(result.error || "تعذّر تنفيذ الأرشفة");
      // يُغلق التأكيد في الحالتين: عند الفشل ليظهر الخطأ في العرض الافتراضي.
      setConfirming(false);
    });
  };

  if (isPending) {
    return (
      <span className="inline-flex p-1.5 text-on-surface-variant" aria-live="polite">
        <Loader2 className="size-5 animate-spin" />
      </span>
    );
  }

  if (isHidden) {
    return (
      <button
        type="button"
        onClick={() => run(false)}
        title="إرجاع الحجز من الأرشيف"
        aria-label="إرجاع الحجز من الأرشيف"
        className="rounded-lg p-1.5 text-emerald-700 transition-colors hover:bg-emerald-100"
      >
        <ArchiveRestore className="size-5" />
      </button>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => run(true)}
          title="تأكيد الأرشفة"
          aria-label="تأكيد الأرشفة"
          className="rounded-lg bg-amber-700 p-1.5 text-white transition-opacity hover:opacity-90"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          title="تراجع"
          aria-label="تراجع"
          className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <X className="size-4" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title="أرشفة الحجز — يخفيه عن العميل وعن اللوحة وعن كل الأقسام المالية"
        aria-label="أرشفة الحجز"
        className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high"
      >
        <Archive className="size-5" />
      </button>
      {error ? <span className="text-[10px] font-bold text-error">{error}</span> : null}
    </span>
  );
}
