import Link from "next/link";
import { BranchFleetQuantityForm } from "@/components/admin/BranchFleetQuantityForm";
import type {
  AdminFleetBranchColumn,
  AdminFleetVehicleSuperRow,
} from "@/lib/fleet-vehicle-admin-data";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";

type Props = {
  branches: AdminFleetBranchColumn[];
  vehicles: AdminFleetVehicleSuperRow[];
};

export function SuperAdminVehiclesTable({ branches, vehicles }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
      <table className="min-w-full border-collapse text-start text-sm">
        <thead>
          <tr className="border-b border-outline-variant/40 bg-surface-container-low">
            <th className="sticky start-0 z-10 bg-surface-container-low px-4 py-3 font-bold text-on-surface-variant">
              صورة
            </th>
            <th className="min-w-[10rem] px-4 py-3 font-bold text-on-surface-variant">المركبة</th>
            <th className="px-4 py-3 font-bold text-on-surface-variant">السنة</th>
            <th className="px-4 py-3 font-bold text-on-surface-variant">السعر / يوم</th>
            <th className="px-4 py-3 text-center font-bold text-on-surface-variant">المجموع</th>
            {branches.map((b) => (
              <th
                key={b.id}
                className="min-w-[7.5rem] px-3 py-3 text-center text-xs font-bold text-on-surface-variant"
              >
                {b.name}
              </th>
            ))}
            <th className="px-4 py-3 font-bold text-on-surface-variant">إجراء</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
            <tr key={v.id} className="border-b border-outline-variant/20 last:border-0">
              <td className="sticky start-0 z-10 bg-surface-container-lowest px-4 py-3">
                <div className="relative h-14 w-24 overflow-hidden rounded-lg bg-surface-container">
                  {v.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-on-surface-variant">
                      —
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 font-bold text-on-surface">
                {v.brandName}
                <span className="mx-1 text-on-surface-variant">|</span>
                {v.modelName}
              </td>
              <td className="px-4 py-3 tabular-nums text-on-surface">{v.year}</td>
              <td className="px-4 py-3 font-bold text-primary">
                <SarAmountWithSymbol amountClassName="tabular-nums font-bold">
                  {v.price.toLocaleString("en-US")}
                </SarAmountWithSymbol>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="inline-flex min-w-[2rem] justify-center rounded-full bg-primary-container/40 px-2.5 py-1 text-sm font-extrabold tabular-nums text-primary">
                  {v.totalQuantity}
                </span>
              </td>
              {v.branchQuantities.map((bq) => (
                <td key={bq.branchId} className="px-2 py-3 align-top">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`text-sm font-extrabold tabular-nums ${
                        bq.quantity > 0 ? "text-on-surface" : "text-on-surface-variant/50"
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
              <td className="px-4 py-3">
                <Link
                  href={`/admin/vehicles/${v.id}/edit`}
                  className="inline-flex rounded-lg border border-outline-variant px-4 py-2 text-xs font-extrabold text-primary transition-colors hover:bg-surface-container"
                >
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
