"use client";

import { useActionState, useState } from "react";
import { Ban, ShieldCheck } from "lucide-react";
import {
  setBookingCustomerBlacklist,
  setCustomerBlacklist,
  type BlacklistActionState,
} from "@/app/admin/customer-blacklist-actions";

type Target = { kind: "booking"; bookingId: number } | { kind: "user"; userId: number };

type Props = {
  target: Target;
  isBlacklisted: boolean;
  reason?: string | null;
  /** ISO — يُعرض بجانب الشارة */
  blacklistedAt?: string | null;
  /** عرض مختصر لصفوف الجداول (بدون سطر السبب والتاريخ) */
  compact?: boolean;
};

/** شارة «قائمة سوداء» — للإدارة فقط. */
export function BlacklistBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-0.5 text-[11px] font-bold text-white">
      <Ban className="size-3" aria-hidden />
      قائمة سوداء
    </span>
  );
}

export function CustomerBlacklistToggle({
  target,
  isBlacklisted,
  reason,
  blacklistedAt,
  compact = false,
}: Props) {
  const action = target.kind === "booking" ? setBookingCustomerBlacklist : setCustomerBlacklist;
  const [rawState, formAction, pending] = useActionState(
    action,
    null as BlacklistActionState | null,
  );
  const [confirming, setConfirming] = useState(false);
  // useActionState بلا reset — نتجاهل آخر نتيجة عند فتح نموذج تأكيد جديد.
  const [dismissed, setDismissed] = useState<BlacklistActionState | null>(null);
  const state = rawState === dismissed ? null : rawState;
  const resetState = () => setDismissed(rawState);

  const hidden =
    target.kind === "booking" ? (
      <input type="hidden" name="bookingId" value={target.bookingId} />
    ) : (
      <input type="hidden" name="userId" value={target.userId} />
    );

  const feedback = state ? (
    <p className={`mt-2 text-xs font-bold ${state.ok ? "text-emerald-700" : "text-error"}`}>
      {state.ok ? state.message : state.error}
    </p>
  ) : null;

  if (isBlacklisted) {
    return (
      <div className={compact ? "inline-flex flex-col items-start" : "space-y-2"}>
        <div className="flex flex-wrap items-center gap-2">
          <BlacklistBadge />
          <form action={formAction} className="inline">
            {hidden}
            <input type="hidden" name="blacklisted" value="0" />
            <button
              type="submit"
              disabled={pending}
              onClick={(e) => {
                if (!confirm("إزالة العميل من القائمة السوداء؟ سيتمكن من الحجز مجدداً.")) {
                  e.preventDefault();
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-600/40 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              {pending ? "…" : "إلغاء الحظر"}
            </button>
          </form>
        </div>
        {!compact && (reason || blacklistedAt) ? (
          <p className="text-xs text-on-surface-variant">
            {blacklistedAt ? (
              <span className="tabular-nums">
                منذ {new Date(blacklistedAt).toLocaleDateString("ar-SA")}
              </span>
            ) : null}
            {reason ? <span> — {reason}</span> : null}
          </p>
        ) : null}
        {feedback}
      </div>
    );
  }

  // بعد نجاح أي إجراء نعود للزر — وإلا بقي نموذج التأكيد مفتوحاً بعد «حظر ثم إلغاء حظر».
  if (!confirming || state?.ok) {
    return (
      <div className={compact ? "inline-flex flex-col items-start" : undefined}>
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
            resetState();
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-900/40 px-2.5 py-1 text-xs font-bold text-zinc-900 hover:bg-zinc-100"
        >
          <Ban className="size-3.5" aria-hidden />
          إضافة للقائمة السوداء
        </button>
        {feedback}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-xl border border-zinc-900/20 bg-zinc-50 p-3">
      {hidden}
      <input type="hidden" name="blacklisted" value="1" />
      <p className="text-xs font-bold text-on-surface">
        العميل لن يتمكن من أي حجز جديد، وسيظهر له رفض عام دون ذكر السبب.
      </p>
      <input
        name="reason"
        maxLength={500}
        placeholder="سبب الحظر (ملاحظة داخلية — اختياري)"
        className="w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-xs"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "…" : "تأكيد الحظر"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-outline-variant/40 px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-white"
        >
          تراجع
        </button>
      </div>
      {feedback}
    </form>
  );
}
