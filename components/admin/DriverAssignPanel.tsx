"use client";

import { Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignBookingDriverAction, type DriverLeg } from "@/app/admin/delivery-driver-actions";

export type DriverOption = {
  id: number;
  name: string;
  phone: string;
  isActive: boolean;
};

export type DriverLegAssignment = {
  leg: DriverLeg;
  label: string;
  driverId: number | null;
  /** ISO — وقت آخر تعيين */
  assignedAt: string | null;
};

function formatAssignedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

function LegRow({
  bookingId,
  item,
  drivers,
  canAssign,
}: {
  bookingId: number;
  item: DriverLegAssignment;
  drivers: DriverOption[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(item.driverId != null ? String(item.driverId) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const saved = item.driverId != null ? String(item.driverId) : "";
  const dirty = value !== saved;
  const current = drivers.find((d) => d.id === item.driverId) ?? null;
  const assignedAt = formatAssignedAt(item.assignedAt);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await assignBookingDriverAction(
        bookingId,
        item.leg,
        value === "" ? null : Number(value),
      );
      if (!res.ok) {
        setError(res.error ?? "تعذّر الحفظ.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <li className="rounded-xl border border-outline-variant/40 bg-surface-container-low/60 px-4 py-3">
      <p className="text-sm font-bold text-on-surface">{item.label}</p>

      {canAssign ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            className="min-w-[14rem] rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 disabled:opacity-60"
          >
            <option value="">— بدون سواق —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id} disabled={!d.isActive && d.id !== item.driverId}>
                {d.name} · {d.phone}
                {!d.isActive ? " (معطّل)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:opacity-50"
          >
            {pending ? "جاري الحفظ…" : "حفظ"}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-sm text-on-surface">
          {current ? `${current.name} · ${current.phone}` : "لم يُعيَّن سواق بعد"}
        </p>
      )}

      {assignedAt && item.driverId != null ? (
        <p className="mt-1.5 text-[11px] text-on-surface-variant">آخر تعيين: {assignedAt}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-bold text-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function DriverAssignPanel({
  bookingId,
  legs,
  drivers,
  canAssign,
}: {
  bookingId: number;
  legs: DriverLegAssignment[];
  drivers: DriverOption[];
  canAssign: boolean;
}) {
  if (legs.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-primary">
        <Truck className="h-4 w-4" aria-hidden />
        سواق التوصيل
      </p>
      <ul className="space-y-2">
        {legs.map((item) => (
          <LegRow
            key={`${item.leg}:${item.driverId ?? "none"}`}
            bookingId={bookingId}
            item={item}
            drivers={drivers}
            canAssign={canAssign}
          />
        ))}
      </ul>
    </div>
  );
}
