import Link from "next/link";
import { Pencil, Fuel, Zap, Leaf, Droplets } from "lucide-react";
import { BranchFleetQuantityForm } from "@/components/admin/BranchFleetQuantityForm";
import { InlineVehicleEditForm } from "@/components/admin/InlineVehicleEditForm";
import { InlineCategoryEditForm } from "@/components/admin/InlineCategoryEditForm";
import type {
  AdminFleetBranchColumn,
  AdminFleetVehicleSuperRow,
} from "@/lib/fleet-vehicle-admin-data";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import type { FuelType, Transmission } from "@prisma/client";

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  GASOLINE: "bg-orange-50  text-orange-700  border-orange-200",
  DIESEL:   "bg-slate-50   text-slate-700   border-slate-200",
  HYBRID:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  ELECTRIC: "bg-blue-50    text-blue-700    border-blue-200",
};

const TRANS_LABEL: Record<Transmission, string> = {
  AUTOMATIC: "أوتو",
  MANUAL:    "يدوي",
};

// ─── Category badge ─────────────────────────────────────────────────────────

function CategoryBadge({ title }: { title: string }) {
  return (
    <span className="inline-block rounded-full border border-outline-variant/60 bg-surface-container px-2.5 py-0.5 text-[11px] font-bold text-on-surface-variant">
      {title}
    </span>
  );
}

// ─── Fuel pill ───────────────────────────────────────────────────────────────

function FuelPill({ fuel, transmission }: { fuel: FuelType; transmission: Transmission }) {
  const Icon = FUEL_ICON[fuel];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${FUEL_COLOR[fuel]}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {FUEL_LABEL[fuel]}
      <span className="text-[10px] opacity-60">· {TRANS_LABEL[transmission]}</span>
    </span>
  );
}

// ─── Table ──────────────────────────────────────────────────────────────────

type Props = {
  branches: AdminFleetBranchColumn[];
  categories: { id: number; title: string }[];
  vehicles: AdminFleetVehicleSuperRow[];
};

export function SuperAdminVehiclesTable({ branches, categories, vehicles }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
      <table className="min-w-full border-collapse text-start text-sm">
        <thead>
          <tr className="border-b border-outline-variant/40 bg-surface-container-low">
            <th className="sticky start-0 z-10 bg-surface-container-low px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              صورة
            </th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              المركبة
            </th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              النوع
            </th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              السنة
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              المقاعد
            </th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              الوقود
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              السعر / يوم
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              المجموع
            </th>
            {branches.map((b) => (
              <th
                key={b.id}
                className="min-w-[7.5rem] px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant"
              >
                {b.name}
              </th>
            ))}
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              إجراء
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-outline-variant/15">
          {vehicles.map((v) => (
            <tr
              key={v.id}
              className="group/row transition-colors hover:bg-surface-container-low/50"
            >
              {/* Image */}
              <td className="sticky start-0 z-10 bg-surface-container-lowest px-4 py-3 group-hover/row:bg-surface-container-low/50">
                <div className="relative h-14 w-24 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container shadow-sm">
                  {v.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-lg text-on-surface-variant/30">
                      🚗
                    </span>
                  )}
                </div>
              </td>

              {/* Vehicle name — clickable */}
              <td className="px-4 py-3">
                <Link
                  href={`/admin/vehicles/${v.id}/edit`}
                  className="group inline-flex flex-col"
                >
                  <span className="whitespace-nowrap font-bold text-on-surface transition-colors group-hover:text-primary">
                    {v.brandName}
                    <span className="mx-1 text-on-surface-variant/50">|</span>
                    {v.modelName}
                  </span>
                  <span className="mt-0.5 text-[11px] font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    تعديل ←
                  </span>
                </Link>
              </td>

              {/* Category */}
              <td className="px-4 py-3 text-center">
                <InlineCategoryEditForm
                  modelId={v.id}
                  defaultValue={v.categoryId}
                  categories={categories}
                />
              </td>

              {/* Year */}
              <td className="px-4 py-3 text-center">
                <InlineVehicleEditForm modelId={v.id} field="year" defaultValue={v.year} />
              </td>

              {/* Seats */}
              <td className="px-4 py-3 text-center">
                <InlineVehicleEditForm modelId={v.id} field="chairs" defaultValue={v.chairs} />
              </td>

              {/* Fuel + transmission */}
              <td className="px-4 py-3">
                <FuelPill fuel={v.fuel} transmission={v.transmission} />
              </td>

              {/* Price */}
              <td className="px-4 py-3 text-center">
                <InlineVehicleEditForm modelId={v.id} field="price" defaultValue={v.price} />
              </td>

              {/* Total quantity */}
              <td className="px-4 py-3 text-center">
                <span
                  className={`inline-flex min-w-[2rem] justify-center rounded-full px-2.5 py-1 text-sm font-extrabold tabular-nums ${
                    v.totalQuantity > 0
                      ? "bg-primary-container/40 text-primary"
                      : "bg-surface-container text-on-surface-variant/50"
                  }`}
                >
                  {v.totalQuantity}
                </span>
              </td>

              {/* Per-branch quantities */}
              {v.branchQuantities.map((bq) => (
                <td key={bq.branchId} className="px-2 py-3 align-middle">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`text-sm font-extrabold tabular-nums ${
                        bq.quantity > 0
                          ? "text-on-surface"
                          : "text-on-surface-variant/40"
                      }`}
                    >
                      {bq.quantity}
                    </span>
                    <BranchFleetQuantityForm
                      modelId={v.id}
                      branchId={bq.branchId}
                      defaultQuantity={bq.quantity}
                      compact
                    />
                  </div>
                </td>
              ))}

              {/* Edit action */}
              <td className="px-4 py-3">
                <Link
                  href={`/admin/vehicles/${v.id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-xs font-extrabold text-primary transition-all hover:border-primary/40 hover:bg-primary-container/20"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  تعديل
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
