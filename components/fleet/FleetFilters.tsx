"use client";

import { Search } from "lucide-react";
import { useState } from "react";

export function FleetFilters() {
  const [maxDaily, setMaxDaily] = useState(2500);

  return (
    <section className="bg-surface-container-low px-8 py-12">
      <div className="mx-auto max-w-screen-2xl">
        <div className="editorial-shadow rounded-2xl bg-surface-container-lowest p-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="space-y-2">
              <label className="ms-1 text-xs font-bold uppercase tracking-widest text-primary">
                التصنيف
              </label>
              <select
                className="w-full rounded-lg border-none bg-surface py-3 ps-4 text-on-surface-variant focus:ring-1 focus:ring-primary-container"
                defaultValue="all"
                dir="rtl"
              >
                <option value="all">كل التصنيفات</option>
                <option value="hyper">هايبر كار</option>
                <option value="sedan">سيدان فاخرة</option>
                <option value="suv">دفع رباعي راقٍ</option>
                <option value="classic">رياضية كلاسيكية</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="ms-1 text-xs font-bold uppercase tracking-widest text-primary">
                الماركة
              </label>
              <select
                className="w-full rounded-lg border-none bg-surface py-3 ps-4 text-on-surface-variant focus:ring-1 focus:ring-primary-container"
                defaultValue="all"
                dir="rtl"
              >
                <option value="all">كل الماركات</option>
                <option value="porsche">Porsche</option>
                <option value="mb">Mercedes-Benz</option>
                <option value="rr">Range Rover</option>
                <option value="bentley">Bentley</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="ms-1 text-xs font-bold uppercase tracking-widest text-primary">
                السعر اليومي (ر.س)
              </label>
              <div className="flex items-center gap-4 py-3">
                <span className="text-sm font-medium" dir="ltr">
                  500
                </span>
                <input
                  className="accent-primary h-2 flex-1 cursor-pointer"
                  type="range"
                  min={500}
                  max={5000}
                  step={50}
                  value={maxDaily}
                  onChange={(e) => setMaxDaily(Number(e.target.value))}
                  aria-label="حد أقصى للسعر اليومي"
                />
                <span className="text-sm font-medium" dir="ltr">
                  5,000+
                </span>
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="gradient-cta flex w-full items-center justify-center gap-2 rounded-lg py-3 font-bold text-white transition-opacity hover:opacity-90"
              >
                <span>تصفية النتائج</span>
                <Search className="size-5 shrink-0" strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
