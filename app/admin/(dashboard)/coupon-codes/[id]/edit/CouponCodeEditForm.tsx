"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateCouponCode, type ActionState } from "@/app/admin/coupon-code-actions";
import type { CouponCodeAdminRow } from "@/lib/coupon-code-admin-data";
import { CouponCodeFields } from "@/app/admin/(dashboard)/coupon-codes/CouponCodeFields";

function dateInputValue(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function CouponCodeEditForm({ coupon }: { coupon: CouponCodeAdminRow }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateCouponCode, null as ActionState | null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <input type="hidden" name="id" value={coupon.id} />
      <h2 className="text-lg font-extrabold tracking-tight md:col-span-2">تعديل الكود</h2>

      <CouponCodeFields
        lockCode
        defaults={{
          code: coupon.code,
          kind: coupon.kind,
          value: coupon.value,
          scope: coupon.scope,
          appliesTo: coupon.appliesTo,
          startsAt: dateInputValue(coupon.startsAt),
          endsAt: dateInputValue(coupon.endsAt),
          maxUses: coupon.maxUses ?? "",
          perCustomerLimit: coupon.perCustomerLimit ?? "",
          isActive: coupon.isActive,
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
