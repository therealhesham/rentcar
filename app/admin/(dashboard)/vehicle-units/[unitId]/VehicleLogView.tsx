"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  Check,
  Edit,
  Gauge,
  Hash,
  Plus,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import {
  completeMaintenanceLogAction,
  createMaintenanceLogAction,
  deleteMaintenanceLogAction,
  updateMaintenanceLogAction,
} from "@/app/admin/vehicle-maintenance-actions";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import { bookingPaymentStatusLabelAr, bookingStatusLabelAr } from "@/lib/booking-display-labels";
import type { VehicleLogData, VehicleLogMaintenance } from "@/lib/vehicle-log";
import {
  MAINTENANCE_KINDS,
  maintenanceKindLabelAr,
  maintenanceStatusLabelAr,
} from "@/lib/vehicle-maintenance-labels";
import { vehicleUnitStatusLabelAr } from "@/lib/vehicle-unit-labels";

type BranchOption = { id: number; name: string };

type Props = {
  log: VehicleLogData;
  branches: BranchOption[];
};

type TabKey = "ALL" | "BOOKINGS" | "MAINTENANCE";

const INPUT_CLASS =
  "w-full rounded-xl border border-outline-variant/40 bg-white p-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary";

const UNIT_STATUS_CLASS: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  RENTED: "bg-sky-100 text-sky-800",
  MAINTENANCE: "bg-amber-100 text-amber-800",
  INACTIVE: "bg-surface-container text-on-surface-variant",
};

const MAINTENANCE_STATUS_CLASS: Record<string, string> = {
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-surface-container text-on-surface-variant",
};

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** قيمة `<input type="date">` من تاريخ مخزَّن (يُقرأ بتوقيت UTC كما حُفظ). */
function toDateInputValue(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function fmtKm(km: number | null): string {
  return km === null ? "—" : `${km.toLocaleString("en-US")} كم`;
}

export function VehicleLogView({ log, branches }: Props) {
  const { unit, bookings, maintenance, stats } = log;
  const [tab, setTab] = useState<TabKey>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<VehicleLogMaintenance | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /** الحجوزات والصيانة في خط زمني واحد مرتَّب من الأحدث للأقدم. */
  const timeline = useMemo(() => {
    const entries = [
      ...bookings.map((b) => ({ type: "BOOKING" as const, at: new Date(b.pickupDate), data: b })),
      ...maintenance.map((m) => ({
        type: "MAINTENANCE" as const,
        at: new Date(m.startedAt),
        data: m,
      })),
    ];
    return entries.sort((a, b) => b.at.getTime() - a.at.getTime());
  }, [bookings, maintenance]);

  function openCreate() {
    setEditingLog(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(entry: VehicleLogMaintenance) {
    setEditingLog(entry);
    setFormError(null);
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = editingLog
        ? await updateMaintenanceLogAction(null, formData)
        : await createMaintenanceLogAction(null, formData);
      if (!res.ok) {
        setFormError(res.error || "حدث خطأ أثناء الحفظ.");
        return;
      }
      setModalOpen(false);
      if (res.warning) alert(res.warning);
    });
  }

  function handleComplete(id: number) {
    startTransition(async () => {
      const res = await completeMaintenanceLogAction(id);
      if (!res.ok) alert(res.error || "تعذّر إغلاق العملية.");
      else if (res.warning) alert(res.warning);
    });
  }

  function handleDelete(id: number) {
    if (!confirm("هل تريد حذف سجل الصيانة هذا نهائياً؟")) return;
    startTransition(async () => {
      const res = await deleteMaintenanceLogAction(id);
      if (!res.ok) alert(res.error || "تعذّر الحذف.");
      else if (res.warning) alert(res.warning);
    });
  }

  return (
    <div className="space-y-6">
      {/* ─── بطاقة بيانات المركبة ──────────────────────────────── */}
      <div className="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div
            className="inline-flex items-center gap-2 rounded-xl border border-[#003749]/15 bg-[#fffdf8] px-4 py-2 text-lg font-black tracking-wide text-[#003749] shadow-xs"
            dir="ltr"
          >
            <Hash className="size-4 text-[#dbb878]" />
            <span>{unit.plateNumber}</span>
          </div>

          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
              UNIT_STATUS_CLASS[unit.status] ?? "bg-surface-container text-on-surface-variant"
            }`}
          >
            {vehicleUnitStatusLabelAr(unit.status)}
          </span>

          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-on-surface-variant">
            <Building2 className="size-4 text-[#8a7752]" />
            {unit.branchName ?? "جميع الفروع"}
          </span>

          {unit.color ? (
            <span className="text-sm font-semibold text-on-surface-variant">
              اللون: {unit.color}
            </span>
          ) : null}

          {unit.chassisNumber ? (
            <span className="text-xs font-semibold text-on-surface-variant" dir="ltr">
              VIN: {unit.chassisNumber}
            </span>
          ) : null}
        </div>

        {unit.notes ? (
          <p className="mt-3 rounded-xl bg-surface-container-low p-3 text-xs font-semibold text-on-surface-variant">
            {unit.notes}
          </p>
        ) : null}
      </div>

      {/* ─── مؤشرات مختصرة ─────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="إجمالي الحجوزات"
          value={`${stats.bookingsCount}`}
          hint={`${stats.completedBookingsCount} تم تسليمها فعلياً`}
        />
        <StatCard
          label="أيام التأجير"
          value={`${stats.totalRentalDays}`}
          hint="بدون الحجوزات الملغاة"
        />
        <StatCard
          label="إيرادات هذه اللوحة"
          value={<SarAmountWithSymbol bold>{formatSarAmount(stats.totalRevenueSar)}</SarAmountWithSymbol>}
          hint="المبالغ المحصَّلة شاملة الضريبة"
        />
        <StatCard
          label="عمليات الصيانة"
          value={`${stats.maintenanceCount}`}
          hint={
            stats.openMaintenanceCount > 0
              ? `${stats.openMaintenanceCount} عملية جارية الآن`
              : "لا توجد عمليات جارية"
          }
        />
        <StatCard
          label="تكلفة الصيانة"
          value={
            <SarAmountWithSymbol bold>{formatSarAmount(stats.totalMaintenanceCostSar)}</SarAmountWithSymbol>
          }
          hint="مجموع فواتير الورش المسجَّلة"
        />
        <StatCard label="آخر قراءة عداد" value={fmtKm(stats.lastOdometerKm)} hint="من أحدث سجل صيانة" />
        <StatCard
          label="الصيانة القادمة (تاريخ)"
          value={fmtDate(stats.nextDueDate)}
          hint={stats.nextDueOverdue ? "⚠️ الموعد فات" : "حسب آخر سجل"}
        />
        <StatCard
          label="الصيانة القادمة (عداد)"
          value={fmtKm(stats.nextDueOdometerKm)}
          hint="الكيلومترات المستحقة"
        />
      </div>

      {/* ─── التبويبات ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-outline-variant/40 bg-white p-1">
          <TabButton active={tab === "ALL"} onClick={() => setTab("ALL")}>
            السجل الكامل ({timeline.length})
          </TabButton>
          <TabButton active={tab === "BOOKINGS"} onClick={() => setTab("BOOKINGS")}>
            الحجوزات ({bookings.length})
          </TabButton>
          <TabButton active={tab === "MAINTENANCE"} onClick={() => setTab("MAINTENANCE")}>
            الصيانة ({maintenance.length})
          </TabButton>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-on-primary shadow-sm hover:opacity-95"
        >
          <Plus className="size-4" />
          تسجيل عملية صيانة
        </button>
      </div>

      {/* ─── السجل الكامل ──────────────────────────────────────── */}
      {tab === "ALL" ? (
        <div className="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-sm">
          {timeline.length === 0 ? (
            <EmptyState text="لا توجد أي حجوزات أو عمليات صيانة مسجَّلة على هذه اللوحة بعد." />
          ) : (
            <ol className="space-y-3">
              {timeline.map((entry) =>
                entry.type === "BOOKING" ? (
                  <li
                    key={`b-${entry.data.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200/60 bg-sky-50/40 p-3.5"
                  >
                    <CalendarClock className="size-4 shrink-0 text-sky-700" />
                    <span className="text-xs font-black text-sky-800">حجز</span>
                    <span className="text-sm font-bold text-on-surface">
                      {fmtDate(entry.data.pickupDate)} · {entry.data.numberOfDays} يوم
                    </span>
                    <span className="text-sm font-semibold text-on-surface-variant">
                      {entry.data.customerName}
                    </span>
                    <span className="text-xs font-bold text-on-surface-variant">
                      {bookingStatusLabelAr(entry.data.status)}
                    </span>
                    <Link
                      href={`/admin/bookings/${entry.data.id}`}
                      className="me-auto text-xs font-extrabold text-primary hover:underline"
                    >
                      عرض الحجز #{entry.data.id}
                    </Link>
                  </li>
                ) : (
                  <li
                    key={`m-${entry.data.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50/40 p-3.5"
                  >
                    <Wrench className="size-4 shrink-0 text-amber-700" />
                    <span className="text-xs font-black text-amber-800">صيانة</span>
                    <span className="text-sm font-bold text-on-surface">
                      {fmtDate(entry.data.startedAt)} · {maintenanceKindLabelAr(entry.data.kind)}
                    </span>
                    <span className="text-sm font-semibold text-on-surface-variant">
                      {entry.data.description}
                    </span>
                    <span className="text-xs font-bold text-on-surface-variant">
                      {maintenanceStatusLabelAr(entry.data.status)}
                    </span>
                    {entry.data.costSar !== null ? (
                      <span className="me-auto text-xs font-extrabold text-on-surface">
                        <SarAmountWithSymbol>{formatSarAmount(entry.data.costSar)}</SarAmountWithSymbol>
                      </span>
                    ) : null}
                  </li>
                ),
              )}
            </ol>
          )}
        </div>
      ) : null}

      {/* ─── الحجوزات ──────────────────────────────────────────── */}
      {tab === "BOOKINGS" ? (
        <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-outline-variant/30 bg-surface-container-low text-xs font-bold text-on-surface-variant">
                <tr>
                  <th className="px-5 py-3.5">رقم الحجز</th>
                  <th className="px-5 py-3.5">العميل</th>
                  <th className="px-5 py-3.5">تاريخ الاستلام</th>
                  <th className="px-5 py-3.5">المدة</th>
                  <th className="px-5 py-3.5">فرع الاستلام / الإرجاع</th>
                  <th className="px-5 py-3.5">الحالة</th>
                  <th className="px-5 py-3.5">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 text-on-surface">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center font-medium text-on-surface-variant">
                      لم تُسلَّم هذه اللوحة لأي عميل حتى الآن.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id} className="transition-colors hover:bg-surface-container-lowest">
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="font-extrabold text-primary hover:underline"
                        >
                          #{b.id}
                        </Link>
                      </td>
                      <td className="px-5 py-4 font-bold">
                        <div>{b.customerName}</div>
                        <div className="text-[11px] font-semibold text-on-surface-variant" dir="ltr">
                          {b.phone}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold">{fmtDate(b.pickupDate)}</td>
                      <td className="px-5 py-4 font-semibold">{b.numberOfDays} يوم</td>
                      <td className="px-5 py-4 text-xs font-semibold text-on-surface-variant">
                        {b.pickupBranchName ?? "—"} ← {b.returnBranchName ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs font-bold">{bookingStatusLabelAr(b.status)}</div>
                        <div className="text-[11px] font-semibold text-on-surface-variant">
                          {bookingPaymentStatusLabelAr(b.paymentStatus)}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-bold">
                        {b.amountSar === null ? (
                          "—"
                        ) : (
                          <SarAmountWithSymbol>{formatSarAmount(b.amountSar)}</SarAmountWithSymbol>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* ─── الصيانة ───────────────────────────────────────────── */}
      {tab === "MAINTENANCE" ? (
        <div className="space-y-3">
          {maintenance.length === 0 ? (
            <div className="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-sm">
              <EmptyState text="لا توجد عمليات صيانة مسجَّلة على هذه اللوحة." />
            </div>
          ) : (
            maintenance.map((m) => (
              <div key={m.id} className="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Wrench className="size-4 text-amber-700" />
                      <span className="text-base font-black text-[#003749]">
                        {maintenanceKindLabelAr(m.kind)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                          MAINTENANCE_STATUS_CLASS[m.status] ??
                          "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {maintenanceStatusLabelAr(m.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-on-surface">{m.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {m.status === "IN_PROGRESS" ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleComplete(m.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:opacity-95 disabled:opacity-50"
                      >
                        <Check className="size-3.5" />
                        إنهاء الصيانة
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openEdit(m)}
                      className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
                      title="تعديل"
                    >
                      <Edit className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      className="rounded-lg p-1.5 text-error/75 transition-colors hover:bg-error-container/40 hover:text-error"
                      title="حذف"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 border-t border-outline-variant/20 pt-4 text-xs sm:grid-cols-3 lg:grid-cols-4">
                  <Field label="تاريخ الدخول" value={fmtDate(m.startedAt)} />
                  <Field label="تاريخ الانتهاء" value={fmtDate(m.completedAt)} />
                  <Field
                    label="التكلفة"
                    value={
                      m.costSar === null ? (
                        "—"
                      ) : (
                        <SarAmountWithSymbol>{formatSarAmount(m.costSar)}</SarAmountWithSymbol>
                      )
                    }
                  />
                  <Field label="الورشة / المزوّد" value={m.vendorName ?? "—"} />
                  <Field label="رقم الفاتورة" value={m.invoiceRef ?? "—"} />
                  <Field label="قراءة العداد" value={fmtKm(m.odometerKm)} />
                  <Field label="الصيانة القادمة" value={fmtDate(m.nextDueDate)} />
                  <Field label="عداد الصيانة القادمة" value={fmtKm(m.nextDueOdometerKm)} />
                  <Field label="الفرع" value={m.branchName ?? "—"} />
                  <Field label="سجّلها" value={m.createdBy ?? "—"} />
                  {m.notes ? <Field label="ملاحظات" value={m.notes} /> : null}
                </dl>
              </div>
            ))
          )}
        </div>
      ) : null}

      {/* ─── نموذج الصيانة (إضافة / تعديل) ──────────────────────── */}
      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <h3 className="text-lg font-black text-[#003749]">
                {editingLog ? "تعديل عملية الصيانة" : `تسجيل صيانة للوحة ${unit.plateNumber}`}
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
              {editingLog ? (
                <input type="hidden" name="logId" value={editingLog.id} />
              ) : (
                <input type="hidden" name="vehicleUnitId" value={unit.id} />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Labeled label="نوع الصيانة" required>
                  <select
                    name="kind"
                    defaultValue={editingLog?.kind ?? "PERIODIC"}
                    required
                    className={INPUT_CLASS}
                  >
                    {MAINTENANCE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {maintenanceKindLabelAr(k)}
                      </option>
                    ))}
                  </select>
                </Labeled>

                <Labeled label="حالة العملية" required>
                  <select
                    name="status"
                    defaultValue={editingLog?.status ?? "IN_PROGRESS"}
                    required
                    className={INPUT_CLASS}
                  >
                    <option value="IN_PROGRESS">جارية (المركبة في الورشة)</option>
                    <option value="COMPLETED">منتهية</option>
                    <option value="CANCELLED">ملغاة</option>
                  </select>
                </Labeled>

                <Labeled label="تاريخ الدخول للصيانة" required>
                  <input
                    type="date"
                    name="startedAt"
                    defaultValue={toDateInputValue(editingLog?.startedAt ?? new Date())}
                    required
                    className={INPUT_CLASS}
                  />
                </Labeled>

                <Labeled label="تاريخ الانتهاء" hint="مطلوب عند اختيار «منتهية»">
                  <input
                    type="date"
                    name="completedAt"
                    defaultValue={toDateInputValue(editingLog?.completedAt ?? null)}
                    className={INPUT_CLASS}
                  />
                </Labeled>
              </div>

              <Labeled label="وصف العمل المنفَّذ" required>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editingLog?.description ?? ""}
                  placeholder="مثال: تغيير زيت وفلتر + فحص الفرامل"
                  required
                  className={`${INPUT_CLASS} resize-none`}
                />
              </Labeled>

              <div className="grid gap-4 sm:grid-cols-3">
                <Labeled label="التكلفة (ر.س)">
                  <input
                    type="number"
                    name="costSar"
                    min={0}
                    step="0.01"
                    defaultValue={editingLog?.costSar ?? ""}
                    placeholder="0"
                    className={INPUT_CLASS}
                  />
                </Labeled>

                <Labeled label="الورشة / المزوّد">
                  <input
                    type="text"
                    name="vendorName"
                    defaultValue={editingLog?.vendorName ?? ""}
                    placeholder="اسم الورشة"
                    className={INPUT_CLASS}
                  />
                </Labeled>

                <Labeled label="رقم الفاتورة">
                  <input
                    type="text"
                    name="invoiceRef"
                    defaultValue={editingLog?.invoiceRef ?? ""}
                    placeholder="اختياري"
                    className={INPUT_CLASS}
                  />
                </Labeled>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Labeled label="قراءة العداد (كم)">
                  <input
                    type="number"
                    name="odometerKm"
                    min={0}
                    step={1}
                    defaultValue={editingLog?.odometerKm ?? ""}
                    placeholder="مثال: 45000"
                    className={INPUT_CLASS}
                  />
                </Labeled>

                <Labeled label="تاريخ الصيانة القادمة">
                  <input
                    type="date"
                    name="nextDueDate"
                    defaultValue={toDateInputValue(editingLog?.nextDueDate ?? null)}
                    className={INPUT_CLASS}
                  />
                </Labeled>

                <Labeled label="عداد الصيانة القادمة (كم)">
                  <input
                    type="number"
                    name="nextDueOdometerKm"
                    min={0}
                    step={1}
                    defaultValue={editingLog?.nextDueOdometerKm ?? ""}
                    placeholder="مثال: 50000"
                    className={INPUT_CLASS}
                  />
                </Labeled>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Labeled label="الفرع المنفِّذ">
                  <select
                    name="branchId"
                    defaultValue={String((editingLog ? editingLog.branchId : unit.branchId) ?? "")}
                    className={INPUT_CLASS}
                  >
                    <option value="">— غير محدد —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Labeled>

                <Labeled label="ملاحظات">
                  <input
                    type="text"
                    name="notes"
                    defaultValue={editingLog?.notes ?? ""}
                    placeholder="اختياري"
                    className={INPUT_CLASS}
                  />
                </Labeled>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-primary py-3 text-sm font-extrabold text-on-primary shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  {isPending ? "جاري الحفظ..." : "حفظ سجل الصيانة"}
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
      ) : null}
    </div>
  );
}

function Labeled({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-on-surface-variant">
        {label} {required ? <span className="text-error">*</span> : null}
        {hint ? <span className="font-semibold opacity-70"> — {hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold text-on-surface-variant">{label}</div>
      <div className="mt-1.5 text-lg font-black text-[#003749]">{value}</div>
      {hint ? (
        <div className="mt-1 text-[11px] font-semibold text-on-surface-variant opacity-80">{hint}</div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="font-bold text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 font-black text-on-surface">{value}</dd>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-extrabold transition-colors ${
        active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Gauge className="size-8 text-outline" />
      <p className="text-sm font-semibold text-on-surface-variant">{text}</p>
    </div>
  );
}
