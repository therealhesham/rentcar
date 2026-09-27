"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Ban, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { setBookingCustomerBlacklist } from "@/app/admin/customer-blacklist-actions";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  bookingId: number;
  customerName?: string | null;
  customerPhone?: string | null;
  /** الحالة الحالية — تحدد هل النافذة للحظر أم لإلغائه */
  isBlacklisted: boolean;
};

/** حظر صاحب الحجز (بسبب إلزامي) أو إلغاء حظره — من قائمة «إجراءات الحجز». */
export function BookingBlacklistModal({
  isOpen,
  onClose,
  bookingId,
  customerName,
  customerPhone,
  isBlacklisted,
}: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; blocked: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isOpen) return null;

  // بعد النجاح يتحدّث `isBlacklisted` مع router.refresh — نثبّت العنوان على الإجراء المنفَّذ.
  const blocking = done ? done.blocked : !isBlacklisted;

  const close = () => {
    if (pending) return;
    setReason("");
    setError(null);
    setDone(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (blocking && !reason.trim()) {
      setError("يرجى كتابة سبب الحظر.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("bookingId", String(bookingId));
    fd.set("blacklisted", blocking ? "1" : "0");
    if (blocking) fd.set("reason", reason.trim());

    startTransition(async () => {
      const res = await setBookingCustomerBlacklist(null, fd);
      if (!res.ok) {
        setError(res.error || "تعذّر تنفيذ الإجراء.");
        return;
      }
      setDone({ message: res.message ?? "تم.", blocked: blocking });
      router.refresh();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4"
        dir="rtl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
          <h3
            className={`flex items-center gap-2 text-base font-extrabold ${
              blocking ? "text-zinc-900" : "text-emerald-800"
            }`}
          >
            {blocking ? (
              <Ban className="size-5 text-zinc-900" />
            ) : (
              <ShieldCheck className="size-5 text-emerald-600" />
            )}
            {blocking ? "إضافة العميل للقائمة السوداء" : "إلغاء حظر العميل"}
          </h3>
          <button
            type="button"
            onClick={close}
            className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        {customerName || customerPhone ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 text-xs space-y-1 text-on-surface-variant">
            {customerName ? (
              <p>
                العميل: <span className="font-bold text-on-surface">{customerName}</span>
              </p>
            ) : null}
            {customerPhone ? (
              <p>
                الجوال:{" "}
                <span className="font-bold text-on-surface tabular-nums" dir="ltr">
                  {customerPhone}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        {done ? (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-relaxed text-emerald-800">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              {done.message}
            </div>
            <div className="flex justify-end pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={close}
                className="rounded-xl bg-[#003749] px-5 py-2 text-xs font-extrabold text-white hover:opacity-90 cursor-pointer shadow-2xs"
              >
                تم
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            ) : null}

            {blocking ? (
              <div>
                <label className="block text-xs font-extrabold text-on-surface mb-1.5">
                  سبب الحظر <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={500}
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مثال: تلفيات متكررة، عدم سداد المستحقات، مخالفات مرورية…"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm font-semibold text-on-surface outline-none focus:ring-2 focus:ring-zinc-900/30"
                />
                <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-on-surface-variant">
                  ملاحظة داخلية للإدارة فقط. لن يتمكن العميل من أي حجز جديد، وسيظهر له رفض عام دون
                  ذكر السبب. الحجوزات القائمة لا تُلغى تلقائياً.
                </p>
              </div>
            ) : (
              <p className="text-sm font-semibold leading-relaxed text-on-surface">
                سيُزال العميل من القائمة السوداء ويتمكن من الحجز مجدداً.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                disabled={pending}
                onClick={close}
                className="rounded-xl border border-outline-variant bg-white px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer disabled:opacity-50"
              >
                تراجع
              </button>
              <button
                type="submit"
                disabled={pending || (blocking && !reason.trim())}
                className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-2xs ${
                  blocking ? "bg-zinc-900" : "bg-emerald-700"
                }`}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    جاري التنفيذ...
                  </>
                ) : blocking ? (
                  "تأكيد الحظر"
                ) : (
                  "إلغاء الحظر"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
