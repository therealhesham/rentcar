"use client";

import { useActionState } from "react";
import { updateFleetVehicle } from "@/app/admin/actions";
import { AdminImageField } from "@/components/admin/AdminImageField";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import type { AdminFleetVehicleEditPayload } from "@/lib/fleet-vehicle-admin-data";

type AdminEditCarFormProps = {
  vehicle: AdminFleetVehicleEditPayload;
};

export function AdminEditCarForm({ vehicle }: AdminEditCarFormProps) {
  const [state, formAction, pending] = useActionState(updateFleetVehicle, null);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <input type="hidden" name="modelId" value={vehicle.id} />

      <h2 className="md:col-span-2 text-lg font-extrabold tracking-tight">
        تعديل سيارة في الأسطول
      </h2>

      <div className="md:col-span-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 text-start">
        <p className="text-xs font-bold text-on-surface-variant">ثابت (للمطابقة مع قاعدة البيانات)</p>
        <p className="mt-1 text-sm font-bold text-on-surface">
          {vehicle.brandName} — {vehicle.categoryTitle} — {vehicle.year}
        </p>
      </div>

      <label className="text-sm font-medium md:col-span-1">
        اسم الموديل (يظهر في صفحة الأسطول)
        <input
          name="modelName"
          required
          defaultValue={vehicle.name}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        الموديل (إنجليزي)
        <input
          name="nameEn"
          defaultValue={vehicle.nameEn ?? ""}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium">
        عدد المقاعد
        <input
          name="chairs"
          type="number"
          required
          min={1}
          max={50}
          defaultValue={vehicle.chairs}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <div className="md:col-span-2 space-y-3">
        <p className="text-sm font-bold text-on-surface">الكمية في كل فرع</p>
        {vehicle.branchFleet.length === 0 ? (
          <p className="text-xs text-on-surface-variant">
            لا يوجد مخزون فرعي بعد — أضف من صفحة أسطول الفرع أو عند الإنشاء.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
            <table className="w-full min-w-[320px] text-start text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-low text-on-surface-variant">
                  <th className="px-3 py-2">الفرع</th>
                  <th className="px-3 py-2">الكمية</th>
                </tr>
              </thead>
              <tbody>
                {vehicle.branchFleet.map((bf, i) => (
                  <tr key={bf.branchId} className="border-b border-outline-variant/15">
                    <td className="px-3 py-2 font-medium">{bf.branchName}</td>
                    <td className="px-3 py-2">
                      <input type="hidden" name="fleetBranchId" value={bf.branchId} />
                      <input
                        name={i === 0 ? "quantity" : `quantity_${bf.branchId}`}
                        type="number"
                        min={0}
                        defaultValue={bf.quantity}
                        className="w-24 rounded-lg border border-outline-variant px-2 py-1.5 text-sm font-bold tabular-nums"
                        dir="ltr"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <span className="block text-xs text-on-surface-variant">
          يُحفظ صف الفرع الأول في النموذج؛ لباقي الفروع استخدم «أسطول الفرع» من موظفي الفروع.
        </span>
      </div>

      <label className="text-sm font-medium md:col-span-2">
        المحرك / الأداء
        <input
          name="engine"
          required
          defaultValue={vehicle.engine}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium">
        ناقل الحركة
        <select
          name="transmission"
          required
          defaultValue={vehicle.transmission}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="AUTOMATIC">أوتوماتيك</option>
          <option value="MANUAL">يدوي</option>
        </select>
      </label>
      <label className="text-sm font-medium">
        نوع الوقود
        <select
          name="fuel"
          required
          defaultValue={vehicle.fuel}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="ELECTRIC">كهرباء</option>
          <option value="GASOLINE">بنزين</option>
          <option value="DIESEL">ديزل</option>
          <option value="HYBRID">هجين</option>
        </select>
      </label>

      <label className="text-sm font-medium">
        السعر (<SarCurrencyGlyph /> / يوم)
        <input
          name="price"
          type="number"
          required
          min={1}
          defaultValue={vehicle.price}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
        <span className="mt-1 block text-xs text-on-surface-variant">
          السعر دون ضريبة؛ يُعرض للعميل كما في بطاقة الأسطول.
        </span>
      </label>
      <label className="text-sm font-medium">
        نسبة ضريبة القيمة المضافة %
        <input
          name="vatRatePercent"
          type="number"
          min={0}
          max={100}
          defaultValue={vehicle.vatRatePercent}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <AdminImageField
        label="صورة السيارة (اترك الرفع فارغًا للإبقاء على الصورة الحالية)"
        fileHelp="بحد أقصى 5 ميجابايت — أو اختر من المعرض لاستبدال الصورة."
        currentImageUrl={vehicle.image}
      />

      <label className="text-sm font-medium md:col-span-2">
        وصف الصورة (alt)
        <input
          name="alt"
          defaultValue={vehicle.alt ?? ""}
          placeholder="وصف قصير للصورة"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        شارة على البطاقة (عربي)
        <input
          name="badge"
          defaultValue={vehicle.badge ?? ""}
          placeholder="مثل: صغيرة"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        شارة (إنجليزي)
        <input
          name="badgeEn"
          defaultValue={vehicle.badgeEn ?? ""}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        إجراء (عربي)
        <input
          name="cta"
          placeholder="مثل: احجز الآن"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        إجراء (إنجليزي)
        <input
          name="ctaEn"
          defaultValue={vehicle.ctaEn ?? ""}
          placeholder="مثل: Book Now"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <div className="md:col-span-2 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="gradient-cta rounded-xl px-8 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ التعديلات"}
        </button>
        {state?.ok ? (
          <p className="text-sm font-bold text-primary" role="status">
            تم التحديث بنجاح.
          </p>
        ) : null}
        {state?.error ? (
          <p className="text-sm font-bold text-error" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
