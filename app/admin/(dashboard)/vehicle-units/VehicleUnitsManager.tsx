"use client";

import { useState, useTransition } from "react";
import { Plus, Search, Car, Hash, Building2, History, Wrench, Trash2, Edit, X, ArrowRight } from "lucide-react";
import Link from "next/link";
import { createVehicleUnitAction, updateVehicleUnitAction, deleteVehicleUnitAction } from "@/app/admin/vehicle-units-actions";
import type { VehicleUnitListItem } from "@/lib/vehicle-units";

type CarModelOption = { id: number; name: string; brandName: string };
type BranchOption = { id: number; name: string };

type Props = {
  units: VehicleUnitListItem[];
  carModels: CarModelOption[];
  branches: BranchOption[];
};

export function VehicleUnitsManager({ units, carModels, branches }: Props) {
  const [query, setQuery] = useState("");
  const [filterModelId, setFilterModelId] = useState<number | "ALL">("ALL");
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<VehicleUnitListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredUnits = units.filter((u) => {
    const q = query.trim().toLowerCase();
    const matchQuery =
      !q ||
      u.plateNumber.toLowerCase().includes(q) ||
      u.carModelName.toLowerCase().includes(q) ||
      u.brandName.toLowerCase().includes(q) ||
      (u.branchName && u.branchName.toLowerCase().includes(q)) ||
      (u.chassisNumber && u.chassisNumber.toLowerCase().includes(q));

    const matchModel = filterModelId === "ALL" || u.carModelId === filterModelId;
    return matchQuery && matchModel;
  });

  function openCreateModal() {
    setEditingUnit(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(unit: VehicleUnitListItem) {
    setEditingUnit(unit);
    setFormError(null);
    setModalOpen(true);
  }

  function handleDelete(id: number, plate: string) {
    if (!confirm(`هل أنت متأكد من حذف لوحة السيارة "${plate}"؟`)) return;
    startTransition(async () => {
      const res = await deleteVehicleUnitAction(id);
      if (!res.ok) alert(res.error || "تعذّر الحذف.");
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = editingUnit
        ? await updateVehicleUnitAction(null, formData)
        : await createVehicleUnitAction(null, formData);

      if (res.ok) {
        setModalOpen(false);
      } else {
        setFormError(res.error || "حدث خطأ أثناء الحفظ.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ─── Top Bar Controls ─────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant/70" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث برقم اللوحة، الموديل، الفرع..."
              className="w-full rounded-xl border border-outline-variant/40 bg-white py-2.5 pr-10 pl-4 text-sm font-semibold text-on-surface outline-none transition-focus focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Model Filter */}
          <select
            value={filterModelId}
            onChange={(e) => setFilterModelId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            className="rounded-xl border border-outline-variant/40 bg-white px-3.5 py-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
          >
            <option value="ALL">جميع الموديلات ({carModels.length})</option>
            {carModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.brandName} {m.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-on-primary shadow-sm hover:opacity-95"
        >
          <Plus className="size-4" />
          إضافة رقم لوحة جديد
        </button>
      </div>

      {/* ─── Vehicle Units Table ──────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-outline-variant/30 bg-surface-container-low text-xs font-bold text-on-surface-variant">
              <tr>
                <th className="px-5 py-3.5">رقم اللوحة</th>
                <th className="px-5 py-3.5">موديل السيارة</th>
                <th className="px-5 py-3.5">الفرع المسجل</th>
                <th className="px-5 py-3.5">اللون / رقم الهيكل</th>
                <th className="px-5 py-3.5">حالة السيارة</th>
                <th className="px-5 py-3.5 text-center">عدد الحجوزات</th>
                <th className="px-5 py-3.5 text-center">عمليات الصيانة</th>
                <th className="px-5 py-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 text-on-surface">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-on-surface-variant font-medium">
                    لا توجد لوحات سيارات مسجلة تطابق محددات البحث.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-surface-container-lowest">
                    {/* Plate */}
                    <td className="px-5 py-4 font-extrabold text-[#003749]">
                      <div className="inline-flex items-center gap-2 rounded-xl border border-[#003749]/15 bg-[#fffdf8] px-3 py-1 text-base font-black tracking-wide text-[#003749] shadow-xs" dir="ltr">
                        <Hash className="size-4 text-[#dbb878]" />
                        <span>{u.plateNumber}</span>
                      </div>
                    </td>

                    {/* Model */}
                    <td className="px-5 py-4 font-bold">
                      <div className="flex items-center gap-2">
                        <Car className="size-4 text-primary shrink-0" />
                        <span>{u.brandName} {u.carModelName}</span>
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="px-5 py-4 font-semibold text-on-surface-variant">
                      {u.branchName ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-[#8a7752]" />
                          {u.branchName}
                        </span>
                      ) : (
                        <span className="text-outline">جميع الفروع</span>
                      )}
                    </td>

                    {/* Color / Chassis */}
                    <td className="px-5 py-4 text-xs font-semibold">
                      <div>{u.color || "—"}</div>
                      {u.chassisNumber ? (
                        <div className="text-[11px] text-on-surface-variant opacity-80" dir="ltr">
                          VIN: {u.chassisNumber}
                        </div>
                      ) : null}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {u.status === "AVAILABLE" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                          متاحة
                        </span>
                      )}
                      {u.status === "RENTED" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800">
                          مؤجرة حالياً
                        </span>
                      )}
                      {u.status === "MAINTENANCE" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                          في الصيانة
                        </span>
                      )}
                      {u.status === "INACTIVE" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-xs font-bold text-on-surface-variant">
                          غير مفعّلة
                        </span>
                      )}
                    </td>

                    {/* Bookings Count */}
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-black text-primary">
                        <History className="size-3.5 text-on-surface-variant" />
                        {u.bookingsCount} مرة
                      </span>
                    </td>

                    {/* Maintenance Count */}
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-black text-[#8a7752]">
                        <Wrench className="size-3.5 text-on-surface-variant" />
                        {u.maintenanceCount}
                      </span>
                      {u.hasOpenMaintenance ? (
                        <div className="mt-1 text-[11px] font-bold text-amber-700">عملية جارية</div>
                      ) : null}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/admin/vehicle-units/${u.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/40 px-2.5 py-1.5 text-xs font-extrabold text-primary transition-colors hover:bg-surface-container"
                          title="سجل السيارة: الحجوزات وعمليات الصيانة"
                        >
                          سجل السيارة
                          <ArrowRight className="size-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors"
                          title="تعديل"
                        >
                          <Edit className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(u.id, u.plateNumber)}
                          className="rounded-lg p-1.5 text-error/75 hover:bg-error-container/40 hover:text-error transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Modal Form (Create / Edit) ───────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5" dir="rtl">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
              <h3 className="text-lg font-black text-[#003749]">
                {editingUnit ? `تعديل السيارة (لوحة: ${editingUnit.plateNumber})` : "إضافة رقم لوحة جديد"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container"
              >
                <X className="size-5" />
              </button>
            </div>

            {formError ? (
              <div className="mt-4 rounded-xl bg-error-container/40 p-3 text-xs font-bold text-error">
                {formError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-right">
              {editingUnit ? <input type="hidden" name="unitId" value={editingUnit.id} /> : null}

              {/* Model */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  موديل السيارة <span className="text-error">*</span>
                </label>
                <select
                  name="carModelId"
                  defaultValue={editingUnit?.carModelId ?? carModels[0]?.id}
                  required
                  className="w-full rounded-xl border border-outline-variant/40 bg-white p-2.5 text-sm font-bold text-on-surface outline-none focus:border-primary"
                >
                  {carModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.brandName} {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plate Number */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  رقم اللوحة <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  name="plateNumber"
                  defaultValue={editingUnit?.plateNumber ?? ""}
                  placeholder="مثال: أ ب ج 1234 أو 1234 ABC"
                  required
                  className="w-full rounded-xl border border-outline-variant/40 bg-white p-2.5 text-sm font-bold text-on-surface outline-none focus:border-primary"
                />
              </div>

              {/* Branch */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  الفرع المسجل فيه السيارة (اختياري)
                </label>
                <select
                  name="branchId"
                  defaultValue={editingUnit?.branchId ?? ""}
                  className="w-full rounded-xl border border-outline-variant/40 bg-white p-2.5 text-sm font-bold text-on-surface outline-none focus:border-primary"
                >
                  <option value="">— جميع الفروع / غير محدد —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color & Chassis */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">
                    اللون
                  </label>
                  <input
                    type="text"
                    name="color"
                    defaultValue={editingUnit?.color ?? ""}
                    placeholder="مثال: أبيض / أبيض لؤلؤي"
                    className="w-full rounded-xl border border-outline-variant/40 bg-white p-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">
                    رقم الهيكل (VIN)
                  </label>
                  <input
                    type="text"
                    name="chassisNumber"
                    defaultValue={editingUnit?.chassisNumber ?? ""}
                    placeholder="اختياري"
                    className="w-full rounded-xl border border-outline-variant/40 bg-white p-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  حالة السيارة
                </label>
                <select
                  name="status"
                  defaultValue={editingUnit?.status ?? "AVAILABLE"}
                  className="w-full rounded-xl border border-outline-variant/40 bg-white p-2.5 text-sm font-bold text-on-surface outline-none focus:border-primary"
                >
                  <option value="AVAILABLE">متاحة للحجز (AVAILABLE)</option>
                  <option value="RENTED">مؤجرة حالياً (RENTED)</option>
                  <option value="MAINTENANCE">في الصيانة (MAINTENANCE)</option>
                  <option value="INACTIVE">غير مفعّلة (INACTIVE)</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  ملاحظات إضافية
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingUnit?.notes ?? ""}
                  placeholder="أي تفاصيل أو ملاحظات عن المركبة..."
                  className="w-full rounded-xl border border-outline-variant/40 bg-white p-2.5 text-xs font-semibold text-on-surface outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-primary py-3 text-sm font-extrabold text-on-primary shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  {isPending ? "جاري الحفظ..." : "حفظ رقم اللوحة"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-outline-variant/40 px-4 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
