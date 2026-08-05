"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateRentalDiscount, type ActionState } from "@/app/admin/rental-discount-actions";
import type { RentalDiscountAdminRow } from "@/lib/rental-discount-admin-data";
import {
  RentalDiscountFields,
  type BrandOpt,
  type BranchOpt,
  type ModelOpt,
} from "@/app/admin/(dashboard)/rental-discounts/RentalDiscountFields";

type Props = {
  discount: RentalDiscountAdminRow;
  brands: BrandOpt[];
  models: ModelOpt[];
  branches: BranchOpt[];
};

function dateInputValue(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function RentalDiscountEditForm({ discount, brands, models, branches }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateRentalDiscount, null as ActionState | null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <input type="hidden" name="id" value={discount.id} />
      <h2 className="text-lg font-extrabold tracking-tight md:col-span-2">تعديل الخصم</h2>

      <RentalDiscountFields
        brands={brands}
        models={models}
        branches={branches}
        defaults={{
          labelAr: discount.labelAr,
          kind: discount.kind,
          appliesTo: discount.appliesTo,
          value: discount.value,
          startsAt: dateInputValue(discount.startsAt),
          endsAt: dateInputValue(discount.endsAt),
          brandId: discount.brandId,
          carModelId: discount.carModelId,
          branchId: discount.branchId,
          sortOrder: discount.sortOrder,
          isActive: discount.isActive,
        }}
      />

      {state?.error ? (
        <p className="text-sm font-bold text-error md:col-span-2">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm font-bold text-primary md:col-span-2">تم حفظ التعديلات.</p>
      ) : null}

      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="gradient-cta rounded-xl px-6 py-3 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ التعديلات"}
        </button>
      </div>
    </form>
  );
}
