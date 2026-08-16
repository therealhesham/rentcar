"use client";

/**
 * تأكيد/رفض الحجز من صفحة تفاصيل الحجز نفسها.
 *
 * نفس إجراء القائمة المنسدلة في `/admin` (`quickUpdateBookingStatus`) — كان
 * التأكيد متاحاً من القوائم الخارجية فقط، فيضطر الموظف يخرج من صفحة الحجز
 * ليؤكده. كل التحقق (الصلاحيات، النطاق، وجود مركبة) يتم في الإجراء نفسه.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { quickUpdateBookingStatus } from "@/app/admin/booking-request-actions";
import { AdminRejectBookingModal } from "./AdminRejectBookingModal";


type Props = {
  bookingRequestId: number;
  /** DIRECT | INQUIRY */
  kind: string;
  status: string;
  /** null في الاستفسارات غير المحوَّلة — التأكيد يتطلب مركبة محدَّدة. */
  carModelId: number | null;
};

export function BookingConfirmPanel({ bookingRequestId, kind, status, carModelId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);

  const statusUpper = status.trim().toUpperCase();
  const isPending = statusUpper === "NEW" || statusUpper === "UNDER_REVIEW";
  // نفس شرط القائمة المنسدلة: الاستفسار يحتاج اختيار مركبة أولاً عبر «تعديل الطلب».
  const canConfirm = kind === "DIRECT" && carModelId != null;

  function run(newStatus: string) {
    setError(null);
    startTransition(async () => {
      const res = await quickUpdateBookingStatus(bookingRequestId, newStatus);
      if (!res.ok) {
        setError(res.error || "حدث خطأ أثناء تحديث الحالة.");
        return;
      }
      setConfirmingReject(false);
      router.refresh();
    });
  }

  if (!isPending) {
    return (
      <p className="text-sm text-on-surface-variant">
        هذا الحجز تجاوز مرحلة التأكيد — لا حاجة لإجراء هنا.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!canConfirm ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          لا يمكن التأكيد قبل تحديد المركبة — افتح «تعديل الطلب» واختر السيارة أولاً.
        </p>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("CONFIRMED")}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" strokeWidth={2.5} />
          )}
          تأكيد الحجز
        </button>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirmingReject(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-error/25 px-4 py-3 text-sm font-bold text-error transition-colors hover:bg-error-container/40 disabled:opacity-60 cursor-pointer"
      >
        <X className="size-4" />
        رفض الطلب
      </button>

      <AdminRejectBookingModal
        isOpen={confirmingReject}
        onClose={() => setConfirmingReject(false)}
        bookingRequestId={bookingRequestId}
      />

      {error ? (
        <p className="flex items-start gap-2 rounded-xl bg-error-container/40 px-4 py-3 text-sm font-medium text-error">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

