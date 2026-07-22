"use client";

import { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import { Pencil, Fuel, Zap, Leaf, Droplets, ChevronDown, Search, Filter, Ban, HelpCircle, CheckCircle2 } from "lucide-react";
import { BranchFleetQuantityForm } from "@/components/admin/BranchFleetQuantityForm";
import { InlineVehicleEditForm } from "@/components/admin/InlineVehicleEditForm";
import { InlineCategoryEditForm } from "@/components/admin/InlineCategoryEditForm";
import type { FuelType, Transmission } from "@prisma/client";

// ─── Constants & Icon Mapping ──────────────────────────────────────────────

const FUEL_ICON: Record<FuelType, React.ElementType> = {
  GASOLINE: Fuel,
  DIESEL:   Droplets,
  HYBRID:   Leaf,
  ELECTRIC: Zap,
};

const FUEL_LABEL: Record<FuelType, string> = {
  GASOLINE: "بنزين",
  DIESEL:   "ديزل",
  HYBRID:   "هجين",
  ELECTRIC: "كهرباء",
};

const FUEL_COLOR: Record<FuelType, string> = {
  GASOLINE: "bg-orange-50/80 text-orange-700 border-orange-200/60 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30",
  DIESEL:   "bg-slate-50/80 text-slate-700 border-slate-200/60 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800/30",
  HYBRID:   "bg-emerald-50/80 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
  ELECTRIC: "bg-blue-50/80 text-blue-700 border-blue-200/60 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30",
};

const TRANS_LABEL: Record<Transmission, string> = {
  AUTOMATIC: "أوتو",
  MANUAL:    "يدوي",
};

// ─── Fuel Pill Component ──────────────────────────────────────────────────

function FuelPill({ fuel, transmission }: { fuel: FuelType; transmission: Transmission }) {
  const Icon = FUEL_ICON[fuel] || HelpCircle;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
        FUEL_COLOR[fuel] || "bg-surface-container text-on-surface"
      }`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {FUEL_LABEL[fuel] || fuel}
      <span className="text-[10px] opacity-60">· {TRANS_LABEL[transmission] || transmission}</span>
    </span>
  );
}

// ─── Table Props ───────────────────────────────────────────────────────────

export type AdminVehicleRow = {
  id: number;
  brandName: string;
  modelName: string;
  categoryId: number;
  categoryTitle: string;
  year: number;
  chairs: number;
  price: number;
  /** السعر الشهري الأساسي للموديل — null = لا يوجد عرض شهري */
  priceMonthlyExclTax?: number | null;
  fuel: FuelType;
  transmission: Transmission;
  image: string | null;
  /** Quantity displayed in the main column (Total for super admin, branch quantity for branch admin) */
  quantity: number;
  /** Quantities per active branch (Super admin only) */
  branchQuantities?: {
    branchId: number;
    quantity: number;
    pricePerDayExclTax?: number | null;
    priceMonthlyExclTax?: number | null;
  }[];
  /** سعر خاص بفرع الموظف (Branch admin only) — null = سعر الموديل الأساسي */
  branchPricePerDayExclTax?: number | null;
  /** سعر شهري خاص بفرع الموظف (Branch admin only) — null = السعر الشهري الأساسي */
  branchPriceMonthlyExclTax?: number | null;
  /** Booking count in this branch (Branch admin only) */
  bookingCount?: number;
};

type Props = {
  isSuperAdmin: boolean;
  branchId?: number | null;
  branchName?: string | null;
  branches: { id: number; name: string; slug: string }[];
  categories: { id: number; title: string }[];
  vehicles: AdminVehicleRow[];
};

export function AdminVehiclesTable({
  isSuperAdmin,
  branchId,
  branchName,
  branches,
  categories,
  vehicles,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [stockFilter, setStockFilter] = useState<"ALL" | "IN_STOCK" | "OUT_OF_STOCK">("ALL");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Toggle expanding a row
  const toggleRow = (id: number) => {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  };

  // Filter and search logic
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // 1. Search Query
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        query === "" ||
        v.brandName.toLowerCase().includes(query) ||
        v.modelName.toLowerCase().includes(query) ||
        v.categoryTitle.toLowerCase().includes(query) ||
        v.id.toString() === query;

      // 2. Category
      const matchCategory =
        selectedCategory === "ALL" || v.categoryId.toString() === selectedCategory;

      // 3. Stock
      const matchStock =
        stockFilter === "ALL" ||
        (stockFilter === "IN_STOCK" && v.quantity > 0) ||
        (stockFilter === "OUT_OF_STOCK" && v.quantity === 0);

      return matchSearch && matchCategory && matchStock;
    });
  }, [vehicles, searchQuery, selectedCategory, stockFilter]);

  return (
    <div className="space-y-4">
      {/* ─── Search & Filters Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <input
            type="text"
            placeholder="البحث عن سيارة (اسم، ماركة، أو ID)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-2.5 pe-4 ps-10 text-sm text-on-surface outline-none ring-primary/30 transition-shadow focus:border-primary/80 focus:ring-2"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> الفئة:
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-bold text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">جميع الفئات</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Filter */}
          <div className="flex items-center gap-2">
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-bold text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">جميع الحالات</option>
              <option value="IN_STOCK">متوفر في المخزون</option>
              <option value="OUT_OF_STOCK">غير متوفر (0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Main Vehicles Table ───────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-start text-sm">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface-container-low/60 text-on-surface-variant">
                <th className="px-4 py-3.5 text-start text-xs font-bold uppercase tracking-wider">المركبة</th>
                <th className="px-4 py-3.5 text-start text-xs font-bold uppercase tracking-wider">الفئة</th>
                <th className="px-4 py-3.5 text-start text-xs font-bold uppercase tracking-wider">المواصفات</th>
                <th className="px-4 py-3.5 text-start text-xs font-bold uppercase tracking-wider">السعر اليومي</th>
                <th className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider">
                  {isSuperAdmin ? "إجمالي الأسطول" : "المخزون بالفرع"}
                </th>
                {!isSuperAdmin && branchName && (
                  <th className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider">الحجوزات النشطة</th>
                )}
                <th className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-outline-variant/15">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 6 : 7}
                    className="px-6 py-12 text-center text-on-surface-variant"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-2xl">🔍</span>
                      <p className="font-bold">لم يتم العثور على سيارات مطابقة للبحث.</p>
                      <p className="text-xs">جرب تغيير كلمات البحث أو الفلاتر أعلاه.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => {
                  const isExpanded = expandedRows.has(v.id);
                  return (
                    <Fragment key={v.id}>
                      {/* Standard Row */}
                      <tr
                        className={`group/row transition-colors hover:bg-surface-container-low/40 ${
                          isExpanded ? "bg-surface-container-low/20" : ""
                        }`}
                      >
                        {/* 1. Vehicle info & Image */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container shadow-xs">
                              {v.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={v.image}
                                  alt={`${v.brandName} ${v.modelName}`}
                                  className="h-full w-full object-cover transition-transform group-hover/row:scale-105"
                                />
                              ) : (
                                <span className="flex h-full items-center justify-center text-base text-on-surface-variant/30">
                                  🚗
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-extrabold text-on-surface group-hover/row:text-primary transition-colors">
                                {v.brandName} {v.modelName}
                              </span>
                              <span className="text-[10px] text-on-surface-variant/80 font-medium">
                                ID: {v.id}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Category badge */}
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-full border border-outline-variant/50 bg-surface-container-low px-2.5 py-0.5 text-[11px] font-bold text-on-surface-variant">
                            {v.categoryTitle}
                          </span>
                        </td>

                        {/* 3. Specs Summary */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-start">
                            <FuelPill fuel={v.fuel} transmission={v.transmission} />
                            <span className="text-[10px] font-semibold text-on-surface-variant">
                              {v.chairs} مقاعد · موديل {v.year}
                            </span>
                          </div>
                        </td>

                        {/* 4. Price */}
                        <td className="px-4 py-3 text-start">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-on-surface tabular-nums">
                              {v.price} ر.س
                            </span>
                            <span className="text-[10px] text-on-surface-variant font-medium">/ يومياً</span>
                          </div>
                        </td>

                        {/* 5. Total Quantity */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex min-w-[2.25rem] justify-center rounded-full px-2.5 py-0.5 text-xs font-black tabular-nums border ${
                              v.quantity > 0
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-surface-container text-on-surface-variant/40 border-outline-variant/20"
                            }`}
                          >
                            {v.quantity}
                          </span>
                        </td>

                        {/* 6. Active Bookings (Branch Admins only) */}
                        {!isSuperAdmin && branchName && (
                          <td className="px-4 py-3 text-center font-bold tabular-nums text-on-surface">
                            {v.bookingCount ?? 0}
                          </td>
                        )}

                        {/* 7. Actions */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleRow(v.id)}
                              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                                isExpanded
                                  ? "bg-surface-container-high border-outline-variant text-on-surface"
                                  : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                              }`}
                            >
                              {isSuperAdmin ? "توزيع المخزون" : "تعديل المخزون والمواصفات"}
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${
                                  isExpanded ? "rotate-180 text-primary" : ""
                                }`}
                              />
                            </button>
                            <Link
                              href={`/admin/vehicles/${v.id}/edit`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary transition-all hover:bg-primary/10"
                              title="تعديل تفصيلي كامل"
                            >
                              <Pencil className="h-4.5 w-4.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-surface-container-lowest/60">
                          <td
                            colSpan={isSuperAdmin ? 6 : 7}
                            className="p-0 border-b border-outline-variant/30"
                          >
                            <div className="border-t border-outline-variant/15 bg-surface-container-lowest px-6 py-5">
                              <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                                {/* RIGHT SIDE: Branch Quantities Management */}
                                <div className="space-y-3.5">
                                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant/80 border-b border-outline-variant/20 pb-2">
                                    {isSuperAdmin
                                      ? "إدارة كميات المركبة في الفروع النشطة"
                                      : `إدارة الكمية في فرعك (${branchName})`}
                                  </h4>

                                  {isSuperAdmin ? (
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                      {v.branchQuantities && v.branchQuantities.length > 0 ? (
                                        v.branchQuantities.map((bq) => {
                                          const branchObj = branches.find((b) => b.id === bq.branchId);
                                          const bName = branchObj ? branchObj.name : `فرع ${bq.branchId}`;
                                          return (
                                            <div
                                              key={bq.branchId}
                                              className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low/50 p-3 transition-colors hover:border-outline-variant/60"
                                            >
                                              <div className="flex flex-col">
                                                <span className="text-xs font-bold text-on-surface">
                                                  {bName}
                                                </span>
                                                <span className="text-[10px] font-semibold text-on-surface-variant">
                                                  الكمية الحالية:{" "}
                                                  <strong className="text-primary font-black tabular-nums">
                                                    {bq.quantity}
                                                  </strong>
                                                </span>
                                                <span className="text-[10px] font-semibold text-on-surface-variant">
                                                  سعر الفرع:{" "}
                                                  <strong className="text-primary font-black tabular-nums">
                                                    {bq.pricePerDayExclTax ?? `${v.price} (الأساسي)`}
                                                  </strong>
                                                </span>
                                                <span className="text-[10px] font-semibold text-on-surface-variant">
                                                  السعر الشهري:{" "}
                                                  <strong className="text-primary font-black tabular-nums">
                                                    {bq.priceMonthlyExclTax ??
                                                      (v.priceMonthlyExclTax != null
                                                        ? `${v.priceMonthlyExclTax} (الأساسي)`
                                                        : "لا يوجد")}
                                                  </strong>
                                                </span>
                                              </div>
                                              <BranchFleetQuantityForm
                                                modelId={v.id}
                                                branchId={bq.branchId}
                                                defaultQuantity={bq.quantity}
                                                defaultPrice={bq.pricePerDayExclTax ?? null}
                                                basePrice={v.price}
                                                defaultMonthlyPrice={bq.priceMonthlyExclTax ?? null}
                                                baseMonthlyPrice={v.priceMonthlyExclTax ?? null}
                                                compact
                                              />
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <p className="col-span-full text-xs text-on-surface-variant py-2">
                                          لا توجد فروع نشطة مرتبطة بهذه السيارة.
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    /* Branch Admin layout: Just one form directly */
                                    <div className="flex items-center justify-between max-w-sm rounded-xl border border-outline-variant/30 bg-surface-container-low/50 p-4">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold text-on-surface">
                                          الكمية المتاحة حالياً
                                        </span>
                                        <span className="text-[10px] text-on-surface-variant font-semibold mt-0.5">
                                          حجوزات الفرع الحالية لهذا الموديل:{" "}
                                          <strong className="text-primary font-black tabular-nums">
                                            {v.bookingCount ?? 0}
                                          </strong>
                                        </span>
                                      </div>
                                      {branchId && (
                                        <BranchFleetQuantityForm
                                          modelId={v.id}
                                          branchId={branchId}
                                          defaultQuantity={v.quantity}
                                          defaultPrice={v.branchPricePerDayExclTax ?? null}
                                          basePrice={v.price}
                                          defaultMonthlyPrice={v.branchPriceMonthlyExclTax ?? null}
                                          baseMonthlyPrice={v.priceMonthlyExclTax ?? null}
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* LEFT SIDE: Quick Specifications Form */}
                                <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low/40 p-4 space-y-4">
                                  <h4 className="text-xs font-black uppercase tracking-wider text-on-surface-variant/80 border-b border-outline-variant/20 pb-2">
                                    تعديل سريع للمواصفات
                                  </h4>
                                  <div className="grid gap-3.5 text-xs">
                                    <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                                      <span className="font-bold text-on-surface-variant">الفئة:</span>
                                      <InlineCategoryEditForm
                                        modelId={v.id}
                                        defaultValue={v.categoryId}
                                        categories={categories}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                                      <span className="font-bold text-on-surface-variant">سنة الصنع:</span>
                                      <InlineVehicleEditForm
                                        modelId={v.id}
                                        field="year"
                                        defaultValue={v.year}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                                      <span className="font-bold text-on-surface-variant">المقاعد:</span>
                                      <InlineVehicleEditForm
                                        modelId={v.id}
                                        field="chairs"
                                        defaultValue={v.chairs}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between pb-1">
                                      <span className="font-bold text-on-surface-variant">السعر اليومي (ر.س):</span>
                                      <InlineVehicleEditForm
                                        modelId={v.id}
                                        field="price"
                                        defaultValue={v.price}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
