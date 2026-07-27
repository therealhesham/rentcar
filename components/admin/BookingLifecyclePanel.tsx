"use client";

import { useActionState, useEffect, useState } from "react";
import { AlarmClock, CarFront, RotateCcw, Key, CheckCircle2, AlertTriangle, Gauge } from "lucide-react";
import {
  recordReturnToBranchAction,
  type ReturnToBranchActionResult,
} from "@/app/admin/booking-lifecycle-actions";
import {
  canRecordPickupFromBranch,
  canRecordReturnToBranch,
  isBookingPickedUp,
  isBookingReturned,
} from "@/lib/booking-lifecycle";
import { bookingStatusLabelAr } from "@/lib/booking-display-labels";
import { formatKm, summarizeBookingOdometer } from "@/lib/booking-odometer";
import { VehiclePlateHandoverModal } from "@/components/admin/VehiclePlateHandoverModal";

function fmtSarNum(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function needsLateDecision(
  s: ReturnToBranchActionResult | null,
): s is Extract<ReturnToBranchActionResult, { needsLateDecision: true }> {
  return s != null && !s.ok && "needsLateDecision" in s && s.needsLateDecision;
}

type Props = {
  bookingRequestId: number;
  kind: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  vehiclePickedUpAt: Date | null;
  vehicleReturnedAt: Date | null;
  carModelId?: number | null;
  currentPlateNumber?: string | null;
  /** رصيد التحصيل من العميل (نفس مصدر صفحة المالية) — يُعرض كتنبيه للموظف. */
  outstandingDueSar?: number;
  /** قراءتا العداد ومدة الحجز — لحساب المسافة المقطوعة وعرضها. */
  odometerAtPickupKm?: number | null;
  odometerAtReturnKm?: number | null;
  numberOfDays?: number;
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
  carModelId = null,
  currentPlateNumber = null,
  outstandingDueSar = 0,
  odometerAtPickupKm = null,
  odometerAtReturnKm = null,
  numberOfDays = 1,
}: Props) {
  const [returnState, returnAction, returnPending] = useActionState(
    recordReturnToBranchAction,
    null,
  );

  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [updatePlateModalOpen, setUpdatePlateModalOpen] = useState(false);

  // إخفاء مودال قرار الغرامة عند «إلغاء» — يُعاد الفتح تلقائياً مع نتيجة جديدة
  const [dismissedLateState, setDismissedLateState] = useState<object | null>(null);
  useEffect(() => {
    setDismissedLateState(null);
  }, [returnState]);

  const showLateModal =
    needsLateDecision(returnState) && dismissedLateState !== returnState;

  if (kind !== "DIRECT") return null;

  const booking = { kind, status, paymentStatus, paymentMethod };
  const showPickup = canRecordPickupFromBranch(booking);
  const showReturn = canRecordReturnToBranch(booking);
  const pickedUp = isBookingPickedUp(status);
  const returned = isBookingReturned(status);

  if (!showPickup && !showReturn && !pickedUp && !returned) return null;

  const pickupAt = fmtWhen(vehiclePickedUpAt);
  const returnAt = fmtWhen(vehicleReturnedAt);
  const odometer = summarizeBookingOdometer({
    odometerAtPickupKm,
    odometerAtReturnKm,
    numberOfDays,
  });

  return (
    <div className="space-y-4">
      <ol className="space-y-2 text-sm">
        <li
          className={[
            "flex items-start justify-between gap-2 rounded-xl border px-3 py-2.5",
            pickedUp || returned
              ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-950"
              : "border-outline-variant/25 bg-surface-container-low/50 text-on-surface-variant",
          ].join(" ")}
        >
          <div className="flex items-start gap-2">
            <CarFront className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-bold">استلام السيارة من الفرع</p>
              {pickupAt ? (
                <p className="mt-0.5 text-xs opacity-90">{pickupAt}</p>
              ) : (
                <p className="mt-0.5 text-xs">لم يُسجَّل بعد</p>
              )}
            </div>
          </div>
          {(pickedUp || returned || showPickup) && (
            <button
              type="button"
              onClick={() => setUpdatePlateModalOpen(true)}
              className="text-xs font-bold text-primary hover:underline self-center"
            >
              {currentPlateNumber ? `تعديل اللوحة (${currentPlateNumber})` : "ربط رقم اللوحة ⚙️"}
            </button>
          )}
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

      {/* ملخص الكيلومترات — يظهر بمجرد تسجيل أي قراءة */}
      {odometer.pickupKm != null || odometer.returnKm != null ? (
        <div className="rounded-xl border border-sky-200/70 bg-sky-50/60 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
            <Gauge className="h-3.5 w-3.5" aria-hidden />
            الكيلومترات
          </p>
          <dl className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-sky-800/70">عند التسليم</dt>
              <dd className="font-bold text-sky-950" dir="ltr">
                {formatKm(odometer.pickupKm)}
              </dd>
            </div>
            <div>
              <dt className="text-sky-800/70">عند الإرجاع</dt>
              <dd className="font-bold text-sky-950" dir="ltr">
                {formatKm(odometer.returnKm)}
              </dd>
            </div>
            <div>
              <dt className="text-sky-800/70">المسافة المقطوعة</dt>
              <dd className="font-extrabold text-sky-950" dir="ltr">
                {formatKm(odometer.distanceKm)}
              </dd>
            </div>
          </dl>
          {odometer.hasInconsistentReadings ? (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-error">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              قراءة الإرجاع أقل من التسليم — راجع الرقم.
            </p>
          ) : odometer.avgPerDayKm != null ? (
            <p className="mt-1.5 text-[11px] font-medium text-sky-800/80">
              بمعدل {formatKm(odometer.avgPerDayKm)} يومياً.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* تنبيه مستحقات — يظهر للموظف طالما فيه رصيد للتحصيل والسيارة لم تُرجَع بعد */}
      {outstandingDueSar > 0 && !returned ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="text-xs leading-relaxed">
            <p className="font-bold">على العميل مبلغ مستحق للتحصيل</p>
            <p className="mt-0.5 text-sm font-extrabold" dir="ltr">
              {fmtSarNum(outstandingDueSar)} ر.س
            </p>
            <p className="mt-0.5 opacity-90">حصّل المبلغ من العميل قبل إتمام استلام السيارة.</p>
          </div>
        </div>
      ) : null}

      {showPickup ? (
        <button
          type="button"
          onClick={() => setHandoverModalOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition-opacity hover:opacity-95"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          تسجيل تسليم السيارة للعميل
        </button>
      ) : null}

      {showReturn ? (
        <form action={returnAction}>
          <input type="hidden" name="bookingRequestId" value={bookingRequestId} />

          {/* قراءة العداد عند الإرجاع — تُقارَن بقراءة التسليم لحساب المسافة */}
          <div className="mb-3">
            <label
              htmlFor="odometerAtReturnKm"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-on-surface-variant"
            >
              <Gauge className="h-3.5 w-3.5 text-sky-600" aria-hidden />
              قراءة العداد عند الإرجاع (كم) — اختياري
            </label>
            <input
              id="odometerAtReturnKm"
              name="odometerAtReturnKm"
              type="number"
              min={odometer.pickupKm ?? 0}
              step={1}
              inputMode="numeric"
              dir="ltr"
              placeholder={
                odometer.pickupKm != null
                  ? `أكبر من ${odometer.pickupKm.toLocaleString("en-US")}`
                  : "مثال: 45850"
              }
              className="w-full rounded-xl border border-outline-variant/40 bg-white p-2.5 text-xs font-bold text-on-surface outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={returnPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary-container/40 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary-container/60 disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {returnPending ? "جاري التسجيل…" : "تسجيل تسليم السيارة إلى الفرع"}
          </button>
          {returnState && !returnState.ok && !needsLateDecision(returnState) ? (
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

          {/* مودال قرار غرامة الإرجاع المتأخر */}
          {showLateModal && needsLateDecision(returnState) ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <AlarmClock className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900">
                      تم استرجاع السيارة متأخراً عن موعد الحجز
                    </h3>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      هل تود تطبيق غرامة تأخير حسب سياسة النظام؟
                    </p>
                  </div>
                </div>

                <dl className="mb-5 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="font-bold text-gray-500">موعد الإرجاع المجدول</dt>
                    <dd className="font-bold text-gray-900" dir="ltr">
                      {new Date(returnState.lateInfo.scheduledReturnAtIso).toLocaleString(
                        "ar-SA",
                        { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" },
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="font-bold text-gray-500">إجمالي التأخير</dt>
                    <dd className="font-extrabold text-amber-700">
                      {returnState.lateInfo.totalLateHours} ساعة
                      {returnState.lateInfo.policyKind === "full_day"
                        ? ` — غرامة ${
                            returnState.lateInfo.billableDays === 1
                              ? "يوم كامل"
                              : returnState.lateInfo.billableDays === 2
                                ? "يومين"
                                : `${returnState.lateInfo.billableDays} أيام`
                          }`
                        : " — غرامة بالساعة"}
                    </dd>
                  </div>
                  {returnState.lateInfo.prepaidDelayFeeExclTax > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="font-bold text-gray-500">
                        مدفوع مسبقاً (ساعات معلنة عند الحجز)
                      </dt>
                      <dd className="font-bold text-emerald-700" dir="ltr">
                        −{fmtSarNum(returnState.lateInfo.prepaidDelayFeeExclTax)} ر.س
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3 border-t border-gray-200 pt-2">
                    <dt className="font-black text-gray-900">
                      الغرامة المستحقة (شاملة الضريبة {returnState.lateInfo.vatRatePercent}٪)
                    </dt>
                    <dd className="font-black text-red-700" dir="ltr">
                      {fmtSarNum(returnState.lateInfo.netPenaltyInclTax)} ر.س
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-col gap-2">
                  <button
                    type="submit"
                    name="latePenaltyDecision"
                    value="APPLY"
                    disabled={returnPending}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
                  >
                    {returnPending ? "جاري التسجيل…" : "تطبيق الغرامة وتسجيل الإرجاع"}
                  </button>
                  <button
                    type="submit"
                    name="latePenaltyDecision"
                    value="WAIVE"
                    disabled={returnPending}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-extrabold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
                  >
                    إعفاء العميل وتسجيل الإرجاع بدون غرامة
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissedLateState(returnState)}
                    className="w-full rounded-xl px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-600"
                  >
                    إلغاء (لن يُسجَّل الإرجاع)
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </form>
      ) : null}

      {/* ─── Handover Modal Popup ──────────────────────────────────────── */}
      <VehiclePlateHandoverModal
        isOpen={handoverModalOpen}
        onClose={() => setHandoverModalOpen(false)}
        bookingId={bookingRequestId}
        carModelId={carModelId}
        mode="HANDOVER"
        currentPlateNumber={currentPlateNumber}
      />

      {/* ─── Update Plate Modal Popup ──────────────────────────────────── */}
      <VehiclePlateHandoverModal
        isOpen={updatePlateModalOpen}
        onClose={() => setUpdatePlateModalOpen(false)}
        bookingId={bookingRequestId}
        carModelId={carModelId}
        mode="UPDATE_ONLY"
        currentPlateNumber={currentPlateNumber}
      />
    </div>
  );
}
