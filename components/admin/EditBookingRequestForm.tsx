"use client";

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
import { parseBookingPricingSnapshot } from "@/lib/booking-pricing-snapshot";

export type EditableBookingRow = {
  id: number;
  kind: "INQUIRY" | "DIRECT";
  fullName: string;
  phone: string;
  ageRange: string;
  carType: string;
  branch: string;
  pickupMode: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string | null;
  pickupDateYmd: string;
  numberOfDays: number;
  termsAccepted: boolean;
  status: string;
  carModelId: number | null;
  carModelLabel: string | null;
  addonsJson: string | null;
  paymentStatus: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  idDocumentKind: string | null;
  nationalIdNumber: string | null;
  passportNumber: string | null;
  licenseNumber: string | null;
  licenseExpiryDate: string | null;
  idCardImageUrl: string | null;
  driverLicenseImageUrl: string | null;
};

type CategoryOption = { slug: string; title: string };

function paymentMethodLabelAr(code: string | null | undefined): string {
  switch (code) {
    case "TABBY":
      return "تابي";
    case "TAMARA":
      return "تمارا";
    case "CARD":
      return "بطاقة ائتمانية";
    case "APPLE_PAY":
      return "Apple Pay";
    case "POINTS":
      return "استبدال نقاط";
    default:
      return code ?? "—";
  }
}

type Props = {
  request: EditableBookingRow;
  categories: CategoryOption[];
  models: BookableModelOption[];
};

function localPhoneFromStored(phone: string): string {
  if (phone.startsWith("+966")) return phone.slice(4);
  return phone.replace(/\D/g, "").replace(/^966/, "");
}

function AddonsSnapshotDisplay({ raw }: { raw: string }) {
  try {
    const { addons, interCityShipping, checkoutOneTimeFees } = parseBookingPricingSnapshot(raw);
    const rows: { key: string; title: string; amount: number | null }[] = [];
    addons.forEach((a, i) => {
      rows.push({
        key: `addon-${i}`,
        title: a.titleAr,
        amount: a.lineTotalExclTax,
      });
    });
    if (interCityShipping && interCityShipping.feeExclVatSar > 0) {
      rows.push({
        key: "inter-city",
        title: interCityShipping.labelAr,
        amount: interCityShipping.feeExclVatSar,
      });
    }
    for (const f of checkoutOneTimeFees) {
      rows.push({
        key: `co-${f.slug}`,
        title: f.labelAr,
        amount: f.feeExclVatSar,
      });
    }
    if (rows.length === 0) {
      return <p className="mt-2 text-xs text-on-surface-variant">لا توجد بنود مسجّلة.</p>;
    }
    return (
      <ul className="mt-2 space-y-2">
        {rows.map((it) => (
          <li
            key={it.key}
            className="flex justify-between gap-2 border-b border-outline-variant/15 pb-2 text-xs last:border-0"
          >
            <span className="font-medium text-on-surface">{it.title}</span>
            <span dir="ltr" className="shrink-0 tabular-nums font-bold text-on-surface-variant">
              {it.amount != null ? (
                <>
                  {it.amount} <SarCurrencyGlyph />
                </>
              ) : (
                ""
              )}
              <span className="ms-1 text-[10px] font-normal">غير شامل الضريبة</span>
            </span>
          </li>
        ))}
      </ul>
    );
  } catch {
    return (
      <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-inverse-surface/5 p-2 text-[10px]" dir="ltr">
        {raw}
      </pre>
    );
  }
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
  { value: "CONFIRMED", label: "مؤكّد" },
  { value: "CANCELLED", label: "ملغى" },
  { value: "REJECTED", label: "مرفوض" },
];

type InnerProps = {
  request: EditableBookingRow;
  categories: CategoryOption[];
  models: BookableModelOption[];
  onClose: () => void;
};

function EditBookingModalInner({
  request,
  categories,
  models,
  onClose,
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
                  {request.paymentStatus === "PAID" ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-extrabold text-emerald-800">
                      مدفوع
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-extrabold text-amber-900">
                      بانتظار الدفع
                    </span>
                  )}
                  {request.paidAt ? (
                    <span className="text-on-surface-variant" dir="ltr">
                      {new Date(request.paidAt).toLocaleString("ar-SA")}
                    </span>
                  ) : null}
                  {request.paymentMethod ? (
                    <span className="w-full basis-full text-on-surface-variant sm:w-auto sm:basis-auto">
                      الطريقة:{" "}
                      <span className="font-bold text-on-surface">
                        {paymentMethodLabelAr(request.paymentMethod)}
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
                request.licenseExpiryDate) ? (
                <div className="sm:col-span-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-3 text-sm">
                  <p className="font-bold text-on-surface">مستندات العميل (عند الإتمام)</p>
                  <dl className="mt-2 space-y-1.5 text-xs">
                    {request.idDocumentKind ? (
                      <div className="flex flex-wrap gap-2">
                        <dt className="font-bold text-on-surface-variant">النوع:</dt>
                        <dd>
                          {request.idDocumentKind === "CITIZEN"
                            ? "مواطن سعودي"
                            : request.idDocumentKind === "RESIDENT_VISITOR"
                              ? "مقيم / زائر"
                              : request.idDocumentKind}
                        </dd>
                      </div>
                    ) : null}
                    {request.nationalIdNumber ? (
                      <div className="flex flex-wrap gap-2">
                        <dt className="font-bold text-on-surface-variant">الهوية:</dt>
                        <dd dir="ltr" className="font-mono">
                          {request.nationalIdNumber}
                        </dd>
                      </div>
                    ) : null}
                    {request.passportNumber ? (
                      <div className="flex flex-wrap gap-2">
                        <dt className="font-bold text-on-surface-variant">الجواز:</dt>
                        <dd dir="ltr" className="font-mono">
                          {request.passportNumber}
                        </dd>
                      </div>
                    ) : null}
                    {request.licenseNumber ? (
                      <div className="flex flex-wrap gap-2">
                        <dt className="font-bold text-on-surface-variant">رقم الرخصة:</dt>
                        <dd dir="ltr" className="font-mono">
                          {request.licenseNumber}
                        </dd>
                      </div>
                    ) : null}
                    {request.licenseExpiryDate ? (
                      <div className="flex flex-wrap gap-2">
                        <dt className="font-bold text-on-surface-variant">انتهاء الرخصة:</dt>
                        <dd dir="ltr" className="font-mono">
                          {request.licenseExpiryDate}
                        </dd>
                      </div>
                    ) : null}
                    {request.idCardImageUrl ? (
                      <div>
                        <a
                          href={request.idCardImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-primary underline"
                        >
                          فتح صورة الهوية / الجواز
                        </a>
                      </div>
                    ) : null}
                    {request.driverLicenseImageUrl ? (
                      <div>
                        <a
                          href={request.driverLicenseImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-primary underline"
                        >
                          فتح صورة الرخصة
                        </a>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : null}
              {request.kind === "DIRECT" && request.addonsJson ? (
                <div className="sm:col-span-2 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-3 text-sm">
                  <p className="font-bold text-on-surface">الإضافات المختارة (عند الطلب)</p>
                  <AddonsSnapshotDisplay raw={request.addonsJson} />
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
                  <option value="jeddah">جدة</option>
                  <option value="madinah">المدينة المنورة</option>
                  <option value="tabuk">تبوك</option>
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
                  defaultValue={request.numberOfDays}
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
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
}: Props) {
  const [open, setOpen] = useState(false);
  const [innerKey, setInnerKey] = useState(0);

  if (request.kind === "INQUIRY" && categories.length === 0) {
    return (
      <p className="max-w-[10rem] text-xs text-on-surface-variant">
        لا توجد فئات أسطول للتعديل.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setInnerKey((k) => k + 1);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/60 bg-surface-container px-2 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-high"
      >
        <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
        تعديل
      </button>

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
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </>
  );
}
