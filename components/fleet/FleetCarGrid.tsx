import type { FleetCar } from "@/lib/fleet-types";
import { FleetCarCard } from "./FleetCarCard";

type FleetCarGridProps = {
  cars: FleetCar[];
};

export function FleetCarGrid({ cars }: FleetCarGridProps) {
  if (cars.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low/50 px-8 py-16 text-center">
        <p className="text-lg font-bold text-on-surface">
          لا توجد مركبات في الأسطول بعد.
        </p>
        <p className="mt-2 text-on-surface-variant">
          أضف مركبات من لوحة الإدارة لتظهر هنا.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
      {cars.map((car) => (
        <FleetCarCard key={car.id} car={car} />
      ))}
    </div>
  );
}
