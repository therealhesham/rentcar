"use client";

import { Search } from "lucide-react";
import { useActionState } from "react";
import { submitBookingRequest } from "@/app/booking-actions";

export function BookingWidget() {
  const [state, formAction, pending] = useActionState(submitBookingRequest, null);

  return (
    <div className="absolute bottom-20 left-1/2 z-20 w-full max-w-6xl -translate-x-1/2 px-8">
      <form
        action={formAction}
        className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-[0_40px_100px_rgba(119,89,39,0.1)]"
      >
        <h3 className="mb-6 text-center text-3xl font-extrabold text-primary">
          طلب حجز سيارة
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              الاسم الكامل
            </label>
            <input
              className="h-12 w-full rounded-xl border-none bg-surface-container-low px-4 text-start text-sm focus:ring-2 focus:ring-primary-container"
              placeholder="الاسم الأول والأخير"
              type="text"
              name="name"
              autoComplete="name"
              dir="rtl"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              الجوال
            </label>
            <div
              className="flex h-12 w-full min-w-0 overflow-hidden rounded-xl bg-surface-container-low focus-within:ring-2 focus-within:ring-primary-container"
              dir="ltr"
            >
              <span
                className="inline-flex items-center border-e border-outline-variant/20 px-3 text-sm font-bold text-on-surface"
              >
                +966
              </span>
              <input
                className="h-full min-w-0 flex-1 border-none bg-transparent px-4 text-start text-sm"
                placeholder="5XXXXXXXX"
                type="tel"
                name="phone"
                autoComplete="tel-national"
                dir="ltr"
                inputMode="numeric"
                pattern="5[0-9]{8}"
                maxLength={9}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              العمر
            </label>
            <select
              className="h-12 w-full appearance-none rounded-xl border-none bg-surface-container-low px-4 text-start text-sm focus:ring-2 focus:ring-primary-container"
              name="age"
              defaultValue="25-35"
              dir="rtl"
              required
            >
              <option value="25-35">25-35</option>
              <option value="35-50">35-50</option>
              <option value="50+">50+</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              نوع السيارة
            </label>
            <select
              className="h-12 w-full appearance-none rounded-xl border-none bg-surface-container-low px-4 text-start text-sm focus:ring-2 focus:ring-primary-container"
              name="carType"
              defaultValue="sedan"
              dir="rtl"
              required
            >
              <option value="sedan">سيدان فاخرة</option>
              <option value="suv">دفع رباعي</option>
              <option value="sports">رياضية</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              الفرع
            </label>
            <select
              className="h-12 w-full appearance-none rounded-xl border-none bg-surface-container-low px-4 text-start text-sm focus:ring-2 focus:ring-primary-container"
              name="branch"
              defaultValue="jeddah"
              dir="rtl"
              required
            >
              <option value="jeddah">جدة</option>
              <option value="madinah">المدينة المنورة</option>
              <option value="tabuk">تبوك</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              تاريخ بداية الحجز
            </label>
            <input
              className="h-12 w-full rounded-xl border-none bg-surface-container-low px-4 text-start text-sm focus:ring-2 focus:ring-primary-container"
              type="date"
              name="pickupDate"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="ms-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              عدد أيام الحجز
            </label>
            <input
              className="h-12 w-full rounded-xl border-none bg-surface-container-low px-4 text-start text-sm focus:ring-2 focus:ring-primary-container"
              type="number"
              min={1}
              max={60}
              name="days"
              placeholder="ادخل عدد الأيام"
              required
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={pending}
              className="golden-gradient flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-60"
            >
              <span>{pending ? "جاري الإرسال..." : "إرسال الطلب"}</span>
              <Search className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>

        <label className="mt-4 flex items-center justify-end gap-2 text-sm text-on-surface-variant">
          <span>أوافق على الشروط والأحكام</span>
          <input type="checkbox" name="terms" required />
        </label>

        {state?.ok ? (
          <p className="mt-3 text-center text-sm font-bold text-primary" role="status">
            تم إرسال طلبك بنجاح، سيتواصل معك فريقنا قريبًا.
          </p>
        ) : null}
        {state?.error ? (
          <p className="mt-3 text-center text-sm font-bold text-error" role="alert">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
