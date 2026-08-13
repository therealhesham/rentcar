"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { updateBookingRequest } from "@/app/admin/booking-request-actions";
import {
  DELIVERY_ADDRESS_MAX_CHARS,
  DELIVERY_ADDRESS_MIN_CHARS,
} from "@/lib/delivery-address";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import type { BookableModelOption } from "@/components/admin/ConvertInquiryToDirectForm";
import { BookingAddonsSnapshot } from "@/components/admin/BookingAddonsSnapshot";
import { BookingAttachmentsPanel } from "@/components/admin/BookingAttachmentsPanel";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { formatDeductDaysSummaryAr } from "@/lib/cancellation-deduct";

import type { EditableBookingRow } from "@/lib/admin-booking-edit-types";

export type { EditableBookingRow } from "@/lib/admin-booking-edit-types";

type CategoryOption = { slug: string; title: string };
type BranchOption = { slug: string; name: string };

function paymentStatusLabelArForBooking(ps: string | null | undefined, balanceDue?: number | null): string {
  const k = String(ps ?? "")
    .trim()
    .toUpperCase();
  if (k === "PAID") return (balanceDue && balanceDue > 0) ? "مدفوع جزئياً" : "مدفوع";
  if (k === "REFUNDED") return "مسترد بالكامل";
  if (k === "PARTIAL_REFUND") return "استرداد جزئي";
  if (k === "NO_REFUND") return "بدون استرداد";
  return "بانتظار الدفع";
}

type Props = {
  request: EditableBookingRow;
  categories: CategoryOption[];
  models: BookableModelOption[];
  branches?: BranchOption[];
  /** فتح نافذة التعديل فوراً (مثلاً من صفحة التفاصيل أو ?edit=1) */
  defaultOpen?: boolean;
  /** إخفاء رابط «عرض التفاصيل» داخل النافذة */
  hideDetailLink?: boolean;
  /** إظهار زر التفعيل في الصفحة أم الاكتفاء بالمودال فقط */
  showTrigger?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
  onModalClose?: () => void;
};

function localPhoneFromStored(phone: string): string {
  if (phone.startsWith("+966")) return phone.slice(4);
  return phone.replace(/\D/g, "").replace(/^966/, "");
}

function defaultInquirySlug(carType: string, categories: CategoryOption[]): string {
  const bySlug = categories.find((c) => c.slug === carType);
  if (bySlug) return bySlug.slug;
  const byTitle = categories.find((c) => c.title === carType);
  if (byTitle) return byTitle.slug;
  return categories[0]?.slug ?? "";
}

/** قيم مخزّنة بالإنجليزية في DB — العرض للمستخدم بالعربية فقط */
const BOOKING_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "NEW", label: "جديد" },
  { value: "UNDER_REVIEW", label: "تحت المراجعة" },
  { value: "CONFIRMED", label: "قادم" },
  { value: "PICKED_UP", label: "استلام السيارة من الفرع" },
  { value: "RETURNED", label: "تسليم السيارة إلى الفرع" },
  { value: "CANCELLED", label: "ملغى" },
  { value: "REJECTED", label: "مرفوض" },
];

type InnerProps = {
  request: EditableBookingRow;
  categories: CategoryOption[];
  models: BookableModelOption[];
  branches?: BranchOption[];
  onClose: () => void;
  hideDetailLink?: boolean;
};

export function EditBookingModalInner({
  request,
  categories,
  models,
  branches,
  onClose,
  hideDetailLink = false,
}: InnerProps) {
  const router = useRouter();
  const titleId = useId();
  const [state, formAction, pending] = useActionState(updateBookingRequest, null);
  const localPhone = useMemo(() => localPhoneFromStored(request.phone), [request.phone]);
  const inquiryDefault = useMemo(
    () => defaultInquirySlug(request.carType, categories),
    [request.carType, categories],
  );

  const modelsForSelect = useMemo(() => {
    if (request.kind !== "DIRECT" || !request.carModelId) return models;
    if (models.some((m) => m.id === request.carModelId)) return models;
    return [
      ...models,
      {
        id: request.carModelId,
        label: request.carModelLabel ?? `موديل #${request.carModelId}`,
      },
    ];
  }, [request.kind, request.carModelId, request.carModelLabel, models]);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onClose();
    }
  }, [state?.ok, router, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="إغلاق"
        disabled={pending}
        className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-sm disabled:cursor-not-allowed"
        onClick={() => {
          if (!pending) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest editorial-shadow"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-outline-variant/30 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-extrabold tracking-tight">
              تعديل الطلب #{request.id}
            </h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              {request.kind === "DIRECT" ? "حجز مباشر" : "طلب استفسار"}
            </p>
            {hideDetailLink ? null : (
              <Link
                href={`/admin/bookings/${request.id}`}
                className="mt-2 inline-block text-xs font-bold text-primary hover:underline"
              >
                عرض التفاصيل والمرفقات
              </Link>
            )}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => onClose()}
            className="rounded-lg px-2 py-1 text-sm font-bold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
          >
            إغلاق
          </button>
        </div>

        <form
          action={formAction}
          className="flex min-h-0 flex-1 flex-col"
        >
          <input type="hidden" name="bookingRequestId" value={request.id} />
          <input
            type="hidden"
            name="pickupMode"
            value={request.pickupMode === "DELIVERY" ? "DELIVERY" : "BRANCH"}
          />
          <input type="hidden" name="deliveryLat" value={request.deliveryLat ?? ""} />
          <input type="hidden" name="deliveryLng" value={request.deliveryLng ?? ""} />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 block text-sm font-bold text-on-surface">
                الاسم الكامل
                <input
                  name="name"
                  required
                  defaultValue={request.fullName}
                  dir="rtl"
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="block text-sm font-bold text-on-surface">
                الجوال (بدون 966)
                <div className="mt-1 flex overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest" dir="ltr">
                  <span className="border-e border-outline-variant/30 px-2 py-2 text-xs font-bold text-on-surface-variant">
                    +966
                  </span>
                  <input
                    name="phone"
                    type="tel"
                    required
                    inputMode="numeric"
                    pattern="5[0-9]{8}"
                    maxLength={9}
                    defaultValue={localPhone}
                    className="min-w-0 flex-1 border-none bg-transparent px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </label>
              <label className="block text-sm font-bold text-on-surface">
                العمر
                <select
                  name="age"
                  required
                  defaultValue={request.ageRange}
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="25-35">25-35</option>
                  <option value="35-50">35-50</option>
                  <option value="50+">50+</option>
                </select>
              </label>
              {request.kind === "DIRECT" ? (
                <div className="sm:col-span-2 flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-xs">
                  <span className="font-bold text-on-surface">حالة الدفع:</span>
                  {(() => {
                    const ps = request.paymentStatus?.trim().toUpperCase() ?? "";
                    const cls =
                      ps === "PAID"
                        ? ((request.balanceDueAtBranchSar ?? 0) > 0 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800")
                        : ps === "REFUNDED"
                          ? "bg-sky-100 text-sky-900"
                          : ps === "PARTIAL_REFUND"
                            ? "bg-violet-100 text-violet-900"
                            : ps === "NO_REFUND"
                              ? "bg-neutral-200 text-neutral-900"
                              : "bg-amber-100 text-amber-900";
                    return (
                      <span className={`rounded-full px-2.5 py-0.5 font-extrabold ${cls}`}>
                        {paymentStatusLabelArForBooking(request.paymentStatus, request.balanceDueAtBranchSar)}
                      </span>
                    );
                  })()}
                  {request.paidAt ? (
                    <span className="text-on-surface-variant" dir="ltr">
                      {new Date(request.paidAt).toLocaleString("ar-SA", {
                        timeZone: "Asia/Riyadh",
                      })}
                    </span>
                  ) : null}
                  {request.paymentMethod ? (
                    <span className="w-full basis-full text-on-surface-variant sm:w-auto sm:basis-auto">
                      الطريقة:{" "}
                      <span className="font-bold text-on-surface">
                        {bookingPaymentMethodLabelAr(request.paymentMethod)}
                      </span>
                    </span>
                  ) : null}
                  <a
                    href={`/fleet/payment/${request.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ms-auto rounded-full bg-primary px-2.5 py-0.5 font-extrabold text-on-primary"
                  >
                    فتح صفحة الدفع
                  </a>
                </div>
              ) : null}
              {request.kind === "DIRECT" &&
              (request.idDocumentKind ||
                request.idCardImageUrl ||
                request.licenseNumber ||
                request.licenseExpiryDate ||
                request.driverLicenseImageUrl) ? (
                <div className="sm:col-span-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-3 text-sm">
                  <p className="font-bold text-on-surface">مستندات العميل (عند الإتمام)</p>
                  <div className="mt-2">
                    <BookingAttachmentsPanel
                      idDocumentKind={request.idDocumentKind}
                      nationalIdNumber={request.nationalIdNumber}
                      passportNumber={request.passportNumber}
                      licenseNumber={request.licenseNumber}
                      licenseExpiryDate={request.licenseExpiryDate}
                      idCardImageUrl={request.idCardImageUrl}
                      driverLicenseImageUrl={request.driverLicenseImageUrl}
                    />
                  </div>
                </div>
              ) : null}
              {request.kind === "DIRECT" && request.addonsJson ? (
                <div className="sm:col-span-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-3 text-sm">
                  <p className="font-bold text-on-surface">الإضافات المختارة (عند الطلب)</p>
                  <div className="mt-2">
                    <BookingAddonsSnapshot raw={request.addonsJson} />
                  </div>
                </div>
              ) : null}
              {request.pickupMode === "DELIVERY" &&
              (request.deliveryLat != null && request.deliveryLng != null
                ? true
                : Boolean(request.deliveryAddress?.trim())) ? (
                <div className="sm:col-span-2 rounded-xl border border-primary-container/40 bg-primary-container/15 px-3 py-3 text-sm">
                  <p className="font-bold text-on-primary-container">توصيل للعميل</p>
                  {request.deliveryAddress?.trim() ? (
                    <p className="mt-2 whitespace-pre-wrap text-on-surface">{request.deliveryAddress.trim()}</p>
                  ) : null}
                  {request.deliveryLat != null && request.deliveryLng != null ? (
                    <>
                      <p className="mt-2 font-mono text-xs tabular-nums text-on-surface" dir="ltr">
                        {request.deliveryLat.toFixed(6)}, {request.deliveryLng.toFixed(6)}
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${request.deliveryLat},${request.deliveryLng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-bold text-primary underline"
                      >
                        فتح في Google Maps
                      </a>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-on-surface-variant">
                      بدون نقطة على الخريطة — العنوان النصّي أعلاه للتوجيه.
                    </p>
                  )}
                </div>
              ) : null}
              {request.pickupMode === "DELIVERY" ? (
                <label className="sm:col-span-2 block text-sm font-bold text-on-surface">
                  عنوان التوصيل (نصّي)
                  <textarea
                    name="deliveryAddress"
                    dir="rtl"
                    rows={3}
                    maxLength={DELIVERY_ADDRESS_MAX_CHARS}
                    defaultValue={request.deliveryAddress ?? ""}
                    placeholder={`عنوان واضح (الحي، الشارع، علامة مميزة) — إن لم تُستخدم الخريطة`}
                    className="mt-1 w-full resize-y rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="mt-1 block text-[11px] font-normal text-on-surface-variant">
                    إن لم تُحدَّد الخريطة: يُعتمد هذا الحقل؛ يُستحسن {DELIVERY_ADDRESS_MIN_CHARS}+ أحرف.
                  </span>
                </label>
              ) : null}
              <label className="block text-sm font-bold text-on-surface">
                الفرع
                <select
                  name="branch"
                  required
                  defaultValue={request.branch}
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  {branches && branches.length > 0 ? (
                    <>
                      {request.branch && !branches.some((b) => b.slug === request.branch) ? (
                        <option value={request.branch}>{request.branch}</option>
                      ) : null}
                      {branches.map((b) => (
                        <option key={b.slug} value={b.slug}>
                          {b.name}
                        </option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value="ared">العريض</option>
                      <option value="anbryiah">العنبرية</option>
                      <option value="aziziyah">العزيزية</option>
                      <option value="palastine-sehaba">فلسطين الصحافة</option>
                      <option value="ajawed">الاجاويد</option>
                      <option value="king-abdelziz-rd">طريق الملك عبدالعزيز</option>
                      <option value="mruj">حي المروج</option>
                    </>
                  )}
                </select>
              </label>
              <label className="block text-sm font-bold text-on-surface">
                تاريخ بداية الحجز
                <input
                  name="pickupDate"
                  type="date"
                  required
                  defaultValue={request.pickupDateYmd}
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="block text-sm font-bold text-on-surface">
                عدد الأيام
                <input
                  name="days"
                  type="number"
                  min={1}
                  max={60}
                  required
                  readOnly={request.fixedDuration}
                  defaultValue={request.numberOfDays}
                  className={`mt-1 w-full rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary ${
                    request.fixedDuration
                      ? "cursor-not-allowed bg-surface-container text-on-surface-variant"
                      : "bg-surface-container-lowest"
                  }`}
                />
                {request.fixedDuration ? (
                  <span className="mt-1 block text-[11px] font-bold text-on-surface-variant">
                    حجز شهري بمدة ثابتة — سعره إجمالي الشهر، فلا يمكن تغيير أيامه.
                  </span>
                ) : null}
              </label>
              <label className="sm:col-span-2 block text-sm font-bold text-on-surface">
                حالة الطلب
                <select
                  name="status"
                  required
                  defaultValue={request.status}
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  {!BOOKING_STATUS_OPTIONS.some((o) => o.value === request.status) ? (
                    <option value={request.status}>
                      قيمة حالية: {request.status}
                    </option>
                  ) : null}
                  {BOOKING_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-on-surface-variant">
                  تُحفظ في النظام بالإنجليزية (NEW، …). الحجز المباشر لا يُحتسب على الأسطول عند «ملغى» أو «مرفوض».
                </span>
              </label>

              <label className="sm:col-span-2 block text-sm font-bold text-on-surface">
                رقم لوحة السيارة المسلّمة (اختياري)
                <input
                  name="vehiclePlateNumber"
                  type="text"
                  defaultValue={request.vehiclePlateNumber ?? ""}
                  placeholder="مثال: أ ب ج 1234 أو 1234 ABC"
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-bold text-[#003749] outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="mt-1 block text-xs text-on-surface-variant">
                  يمكنك تحديد أو تعديل رقم اللوحة المرتبطة بهذه السيارة.
                </span>
              </label>

              {request.status.trim().toUpperCase() === "CANCELLED" &&
              (request.cancelledAt != null ||
                (request.cancellationDeductedDays != null && request.cancellationDeductedDays > 0) ||
                request.cancellationRefundAmountSar != null ||
                ["REFUNDED", "PARTIAL_REFUND", "NO_REFUND"].includes(
                  request.paymentStatus?.trim().toUpperCase() ?? "",
                )) ? (
                <div className="sm:col-span-2 rounded-xl border border-outline-variant/40 bg-surface-container-high/40 p-3 text-sm">
                  <p className="font-bold text-on-surface">بيانات إلغاء ذاتي (إن وُجدت)</p>
                  {request.cancelledAt ? (
                    <p className="mt-1 text-xs text-on-surface-variant" dir="ltr">
                      وقت الإلغاء:{" "}
                      {new Date(request.cancelledAt).toLocaleString("ar-SA", {
                        timeZone: "Asia/Riyadh",
                      })}
                    </p>
                  ) : null}
                  {request.cancellationDeductedDays != null && request.cancellationDeductedDays > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-on-surface">
                      خصم أيام مسجّل:{" "}
                      <span className="tabular-nums">
                        {formatDeductDaysSummaryAr(request.cancellationDeductedDays)}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      لا يوجد خصم أيام مسجّل على الطلب (إلغاء يدوي أو سياسة بلا خصم).
                    </p>
                  )}
                  {request.paymentMethod ? (
                    <p className="mt-1 text-xs text-on-surface">
                      وسيلة الدفع / الاسترداد:{" "}
                      <span className="font-bold">{bookingPaymentMethodLabelAr(request.paymentMethod)}</span>
                    </p>
                  ) : null}
                  {typeof request.cancellationRefundAmountSar === "number" ? (
                    <p className="mt-1 text-xs font-semibold text-on-surface" dir="ltr">
                      مبلغ الاسترداد (شامل الضريبة):{" "}
                      <span className="tabular-nums font-extrabold">
                        {request.cancellationRefundAmountSar.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <SarCurrencyGlyph className="inline h-[0.9em] w-[0.9em]" />
                      </span>
                    </p>
                  ) : null}
                  {request.cancellationRefundExternalRef ? (
                    <p className="mt-1 break-all text-[11px] text-on-surface-variant" dir="ltr">
                      مرجع الاسترداد: {request.cancellationRefundExternalRef}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {request.kind === "INQUIRY" ? (
                <label className="sm:col-span-2 block text-sm font-bold text-on-surface">
                  فئة السيارة
                  <select
                    name="inquiryCarType"
                    required
                    defaultValue={inquiryDefault}
                    className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="sm:col-span-2 block text-sm font-bold text-on-surface">
                  السيارة (موديل)
                  <select
                    name="carModelId"
                    required
                    defaultValue={request.carModelId ?? ""}
                    className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="" disabled>
                      اختر السيارة…
                    </option>
                    {modelsForSelect.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="sm:col-span-2 flex cursor-pointer items-start gap-2 text-sm font-bold text-on-surface">
                <input
                  name="terms"
                  type="checkbox"
                  defaultChecked={request.termsAccepted}
                  className="mt-1 rounded border-outline-variant"
                />
                <span>الموافقة على الشروط والأحكام (مسجّلة في الطلب)</span>
              </label>
            </div>

            {state?.error ? (
              <p
                className="mt-4 rounded-xl bg-error-container px-3 py-2 text-sm font-medium text-error"
                role="alert"
              >
                {state.error}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-outline-variant/30 px-5 py-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => onClose()}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-on-primary disabled:opacity-60"
            >
              {pending ? "جاري الحفظ…" : "حفظ التعديلات"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export function EditBookingRequestForm({
  request,
  categories,
  models,
  branches,
  defaultOpen = false,
  hideDetailLink = false,
  showTrigger = true,
  triggerLabel = "تعديل",
  triggerClassName,
  onModalClose,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [innerKey, setInnerKey] = useState(0);

  useEffect(() => {
    if (defaultOpen) {
      setInnerKey((k) => k + 1);
      setOpen(true);
    }
  }, [defaultOpen]);

  const closeModal = () => {
    setOpen(false);
    onModalClose?.();
  };

  if (request.kind === "INQUIRY" && categories.length === 0) {
    return (
      <p className="max-w-[10rem] text-xs text-on-surface-variant">
        لا توجد فئات أسطول للتعديل.
      </p>
    );
  }

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          onClick={() => {
            setInnerKey((k) => k + 1);
            setOpen(true);
          }}
          className={
            triggerClassName ??
            "inline-flex items-center gap-1 rounded-lg border border-outline-variant/60 bg-surface-container px-2 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-high"
          }
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {triggerLabel}
        </button>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
        >
          <EditBookingModalInner
            key={innerKey}
            request={request}
            categories={categories}
            models={models}
            branches={branches}
            hideDetailLink={hideDetailLink}
            onClose={closeModal}
          />
        </div>
      ) : null}
    </>
  );
}
