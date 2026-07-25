"use client";

import { useState, useEffect, useTransition } from "react";
import { X, Key, Loader2, Hash, Check } from "lucide-react";
import { recordPickupFromBranchAction, updateBookingVehiclePlateAction } from "@/app/admin/booking-lifecycle-actions";
import { fetchVehicleUnitOptionsAction } from "@/app/admin/vehicle-units-actions";

type VehicleOption = {
  id: number;
  plateNumber: string;
  color: string | null;
  status: string;
  branch: { name: string } | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  bookingId: number;
  carModelId: number | null;
  mode?: "HANDOVER" | "UPDATE_ONLY";
  currentPlateNumber?: string | null;
  onSuccess?: () => void;
};

export function VehiclePlateHandoverModal({
  isOpen,
  onClose,
  bookingId,
  carModelId,
  mode = "HANDOVER",
  currentPlateNumber,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [customPlate, setCustomPlate] = useState(currentPlateNumber || "");
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setCustomPlate(currentPlateNumber || "");
      setSelectedUnitId("");
      if (carModelId) {
        setLoadingUnits(true);
        fetchVehicleUnitOptionsAction(carModelId).then((res) => {
          if (res.ok && res.options) {
            setVehicleOptions(res.options);
            // If currentPlateNumber matches any unit, select it
            const matched = res.options.find((o) => o.plateNumber === currentPlateNumber);
            if (matched) setSelectedUnitId(String(matched.id));
          }
          setLoadingUnits(false);
        });
      }
    }
  }, [isOpen, carModelId, currentPlateNumber]);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      let res;
      if (mode === "HANDOVER") {
        const formData = new FormData();
        formData.append("bookingRequestId", String(bookingId));
        if (selectedUnitId) formData.append("vehicleUnitId", selectedUnitId);
        if (customPlate.trim()) formData.append("vehiclePlateNumber", customPlate.trim());
        res = await recordPickupFromBranchAction(null, formData);
      } else {
        const unitIdNum = selectedUnitId ? Number(selectedUnitId) : undefined;
        res = await updateBookingVehiclePlateAction(
          bookingId,
          unitIdNum,
          customPlate.trim() || undefined,
        );
      }

      if (res.ok) {
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.error || "حدث خطأ أثناء حفظ رقم اللوحة.");
      }
    });
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-3xl border border-outline-variant/30 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150" dir="rtl">
        <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/20">
          <h3 className="text-base font-black text-[#003749] flex items-center gap-2">
            <Key className="size-4 text-sky-600" />
            {mode === "HANDOVER" ? "تسليم السيارة للعميل" : "تعديل / ربط رقم لوحة السيارة"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container"
          >
            <X className="size-4" />
          </button>
        </div>

        {errorMsg ? (
          <div className="mt-3 rounded-xl bg-error-container/40 p-3 text-xs font-bold text-error">
            {errorMsg}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-right">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {mode === "HANDOVER"
              ? "هل تم تسليم السيارة للعميل بالفعل؟ يمكنك تحديد رقم اللوحة لربط المركبة بالحجز (اختياري)."
              : "يمكنك تغيير أو ربط رقم لوحة السيارة التابعة لهذا الحجز بأي وقت."}
          </p>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
              اختر رقم لوحة السيارة من الأسطول المسجل (اختياري)
            </label>
            {loadingUnits ? (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant py-2">
                <Loader2 className="size-3.5 animate-spin" />
                <span>جاري تحميل اللوحات المتاحة...</span>
              </div>
            ) : (
              <select
                value={selectedUnitId}
                onChange={(e) => {
                  setSelectedUnitId(e.target.value);
                  if (e.target.value) {
                    const found = vehicleOptions.find((o) => String(o.id) === e.target.value);
                    if (found) setCustomPlate(found.plateNumber);
                  }
                }}
                className="w-full rounded-xl border border-outline-variant/40 bg-white p-2.5 text-xs font-bold text-on-surface outline-none focus:border-primary"
              >
                <option value="">— بدون تحديد من الأسطول (اختياري) —</option>
                {vehicleOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} {v.color ? `(${v.color})` : ""} {v.branch?.name ? `— ${v.branch.name}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>


          <div className="pt-2 flex gap-2.5">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-primary py-3 text-xs font-extrabold text-on-primary shadow-sm hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : mode === "HANDOVER" ? (
                "تأكيد تسليم السيارة"
              ) : (
                "حفظ رقم اللوحة"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-outline-variant/40 px-4 py-3 text-xs font-bold text-on-surface-variant hover:bg-surface-container"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
