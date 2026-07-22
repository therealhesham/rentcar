"use client";

import Image from "next/image";
import { useActionState } from "react";
import { updateFleetVisibility, updateFleetDisplayOrder } from "@/app/admin/fleet-visibility-actions";

export type FleetVisibilityRow = {
  id: number;
  modelId: number;
  modelDisplayOrder: number;
  modelName: string;
  modelYear: number;
  modelImage: string | null;
  modelAlt: string | null;
  branchName: string;
  quantity: number;
  activeBookings: number;
  isVisible: boolean;
};

function VisibilityToggle({ row }: { row: FleetVisibilityRow }) {
  const [state, action] = useActionState(updateFleetVisibility, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="fleetId" value={row.id} />
      <input type="hidden" name="isVisible" value={String(!row.isVisible)} />
      <button
        type="submit"
        dir="ltr"
        title={row.isVisible ? "إخفاء من العملاء" : "إظهار للعملاء"}
        className={[
          "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full",
          "border-2 border-transparent transition-colors duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          row.isVisible ? "bg-primary" : "bg-gray-300",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md",
            "ring-0 transition-transform duration-200",
            row.isVisible ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
      {state && !state.ok && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}

function OrderButtons({
  row,
  isFirst,
  isLast,
}: {
  row: FleetVisibilityRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [stateUp, actionUp] = useActionState(updateFleetDisplayOrder, null);
  const [stateDown, actionDown] = useActionState(updateFleetDisplayOrder, null);

  return (
    <div className="flex items-center gap-1">
      <form action={actionUp}>
        <input type="hidden" name="fleetId" value={row.id} />
        <input type="hidden" name="direction" value="up" />
        <button
          type="submit"
          disabled={isFirst}
          title="تحريك للأعلى"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-sm hover:bg-surface-container disabled:opacity-30"
        >
          ↑
        </button>
      </form>
      <form action={actionDown}>
        <input type="hidden" name="fleetId" value={row.id} />
        <input type="hidden" name="direction" value="down" />
        <button
          type="submit"
          disabled={isLast}
          title="تحريك للأسفل"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-sm hover:bg-surface-container disabled:opacity-30"
        >
          ↓
        </button>
      </form>
      {((stateUp && !stateUp.ok) || (stateDown && !stateDown.ok)) && (
        <span className="text-xs text-red-600">
          {stateUp?.error ?? stateDown?.error}
        </span>
      )}
    </div>
  );
}

export function FleetVisibilityClient({ rows }: { rows: FleetVisibilityRow[] }) {
  // حساب ترتيب كل موديل (بدون تكرار) لتحديد isFirst/isLast بدقة
  const uniqueModelIds = Array.from(new Set(rows.map((r) => r.modelId)));
  const modelPos = new Map(uniqueModelIds.map((id, i) => [id, i]));

  return (
    <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:p-6">
      {rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">لا توجد مركبات في الأسطول حالياً.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-start text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                <th className="px-3 py-2 text-start">الترتيب</th>
                <th className="px-3 py-2 text-start"></th>
                <th className="px-3 py-2 text-start">المركبة</th>
                <th className="px-3 py-2 text-start">الفرع</th>
                <th className="px-3 py-2 text-center">الوحدات</th>
                <th className="px-3 py-2 text-center">حجوزات نشطة</th>
                <th className="px-3 py-2 text-center">متاح</th>
                <th className="px-3 py-2 text-center">إظهار للعملاء</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const freeSlots = Math.max(0, row.quantity - row.activeBookings);
                const fullyBooked = freeSlots === 0;
                // أزرار الترتيب تظهر فقط على أول صف من كل موديل
                const isFirstRowOfModel = rows[idx - 1]?.modelId !== row.modelId;
                const pos = modelPos.get(row.modelId) ?? 0;
                const isFirstModel = pos === 0;
                const isLastModel = pos === uniqueModelIds.length - 1;
                return (
                  <tr
                    key={row.id}
                    className={[
                      "border-b border-outline-variant/10 transition-colors",
                      fullyBooked ? "bg-error-container/10" : "",
                      !row.isVisible ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <td className="px-3 py-2">
                      {isFirstRowOfModel ? (
                        <OrderButtons row={row} isFirst={isFirstModel} isLast={isLastModel} />
                      ) : (
                        <div className="w-[62px]" />
                      )}
                    </td>
                    <td className="px-2 py-1">
                      <div className="relative h-10 w-16 overflow-hidden rounded-lg bg-surface-container">
                        {row.modelImage ? (
                          <Image
                            src={row.modelImage}
                            alt={row.modelAlt ?? row.modelName}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">—</div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{row.modelName}</span>
                      <span className="mr-1.5 text-xs text-on-surface-variant">{row.modelYear}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-md bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                        {row.branchName}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">{row.quantity}</td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {row.activeBookings > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-error-container px-2 py-0.5 text-xs font-bold text-on-error-container">
                          {row.activeBookings} محجوز
                        </span>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {fullyBooked ? (
                        <span className="inline-flex items-center rounded-full bg-error-container px-2.5 py-0.5 text-xs font-bold text-on-error-container">
                          0 متاح
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-bold text-on-primary-container">
                          {freeSlots} متاح
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <VisibilityToggle row={row} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
