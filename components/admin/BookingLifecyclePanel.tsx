"use client";

import { useActionState } from "react";
import { CarFront, CheckCircle2, RotateCcw } from "lucide-react";
import {
  recordPickupFromBranchAction,
  recordReturnToBranchAction,
} from "@/app/admin/booking-lifecycle-actions";
import {
  canRecordPickupFromBranch,
  canRecordReturnToBranch,
  isBookingPickedUp,
  isBookingReturned,
} from "@/lib/booking-lifecycle";
import { bookingStatusLabelAr } from "@/lib/booking-display-labels";

type Props = {
  bookingRequestId: number;
  kind: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  vehiclePickedUpAt: Date | null;
  vehicleReturnedAt: Date | null;
};

function fmtWhen(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Riyadh",
  });
}

export function BookingLifecyclePanel({
  bookingRequestId,
  kind,
  status,
  paymentStatus,
  paymentMethod,
  vehiclePickedUpAt,
  vehicleReturnedAt,
}: Props) {
  const [pickupState, pickupAction, pickupPending] = useActionState(
    recordPickupFromBranchAction,
    null,
  );
  const [returnState, returnAction, returnPending] = useActionState(
    recordReturnToBranchAction,
    null,
  );

  if (kind !== "DIRECT") return null;

  const booking = { kind, status, paymentStatus, paymentMethod };
  const showPickup = canRecordPickupFromBranch(booking);
  const showReturn = canRecordReturnToBranch(booking);
  const pickedUp = isBookingPickedUp(status);
  const returned = isBookingReturned(status);

  if (!showPickup && !showReturn && !pickedUp && !returned) return null;

  const pickupAt = fmtWhen(vehiclePickedUpAt);
  const returnAt = fmtWhen(vehicleReturnedAt);

  return (
    <div className="space-y-4">
      <ol className="space-y-2 text-sm">
        <li
          className={[
            "flex items-start gap-2 rounded-xl border px-3 py-2.5",
            pickedUp || returned
              ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-950"
              : "border-outline-variant/25 bg-surface-container-low/50 text-on-surface-variant",
          ].join(" ")}
        >
          <CarFront className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">استلام السيارة من الفرع</p>
            {pickupAt ? (
              <p className="mt-0.5 text-xs opacity-90">{pickupAt}</p>
            ) : (
              <p className="mt-0.5 text-xs">لم يُسجَّل بعد</p>
            )}
          </div>
        </li>
        <li
          className={[
            "flex items-start gap-2 rounded-xl border px-3 py-2.5",
            returned
              ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-950"
              : "border-outline-variant/25 bg-surface-container-low/50 text-on-surface-variant",
          ].join(" ")}
        >
          <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">تسليم السيارة إلى الفرع (الإرجاع)</p>
            {returnAt ? (
              <p className="mt-0.5 text-xs opacity-90">{returnAt}</p>
            ) : (
              <p className="mt-0.5 text-xs">لم يُسجَّل بعد</p>
            )}
          </div>
        </li>
      </ol>

      <p className="text-xs text-on-surface-variant">
        الحالة الحالية:{" "}
        <span className="font-bold text-on-surface">{bookingStatusLabelAr(status)}</span>
      </p>

      {showPickup ? (
        <form action={pickupAction}>
          <input type="hidden" name="bookingRequestId" value={bookingRequestId} />
          <button
            type="submit"
            disabled={pickupPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition-opacity hover:opacity-95 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {pickupPending ? "جاري التسجيل…" : "تسجيل استلام السيارة من الفرع"}
          </button>
          {pickupState && !pickupState.ok ? (
            <p className="mt-2 text-xs font-bold text-red-700">{pickupState.error}</p>
          ) : null}
          {pickupState?.ok ? (
            <p className="mt-2 text-xs font-bold text-emerald-800">تم تسجيل الاستلام.</p>
          ) : null}
        </form>
      ) : null}

      {showReturn ? (
        <form action={returnAction}>
          <input type="hidden" name="bookingRequestId" value={bookingRequestId} />
          <button
            type="submit"
            disabled={returnPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary-container/40 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary-container/60 disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {returnPending ? "جاري التسجيل…" : "تسجيل تسليم السيارة إلى الفرع"}
          </button>
          {returnState && !returnState.ok ? (
            <p className="mt-2 text-xs font-bold text-red-700">{returnState.error}</p>
          ) : null}
          {returnState?.ok ? (
            <p className="mt-2 text-xs font-bold text-emerald-800">
              تم تسجيل الإرجاع
              {paymentMethod?.trim().toUpperCase() === "CASH"
                ? " وإرسال الفاتورة إلى بريد العميل (إن وُجد)."
                : "."}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
