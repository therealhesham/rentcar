"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { updateBookingRequest } from "@/app/admin/booking-request-actions";
import type { BookableModelOption } from "@/components/admin/ConvertInquiryToDirectForm";

export type EditableBookingRow = {
  id: number;
  kind: "INQUIRY" | "DIRECT";
  fullName: string;
  phone: string;
  ageRange: string;
  carType: string;
  branch: string;
  pickupDateYmd: string;
  numberOfDays: number;
  termsAccepted: boolean;
  status: string;
  carModelId: number | null;
  carModelLabel: string | null;
};

type CategoryOption = { slug: string; title: string };

type Props = {
  request: EditableBookingRow;
  categories: CategoryOption[];
  models: BookableModelOption[];
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
