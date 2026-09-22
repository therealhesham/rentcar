"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateCustomizedCoupon, type ActionState } from "@/app/admin/customized-coupon-actions";
import type { CustomizedCouponAdminRow } from "@/lib/customized-coupon-admin-data";
import { CustomizedCouponFields } from "@/app/admin/(dashboard)/customized-coupons/CustomizedCouponFields";

function dateInputValue(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

/** يحذف بادئة +966 من الرقم المخزَّن ليعرضها الحقل بصيغة محلية (5xxxxxxxx). */
function localPhone(phone: string): string {
  return phone.startsWith("+966") ? phone.slice(4) : phone;
}

export function CustomizedCouponEditForm({ coupon }: { coupon: CustomizedCouponAdminRow }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateCustomizedCoupon,
    null as ActionState | null,
  );

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

      {coupon.isUsed ? (
        <p className="rounded-xl bg-outline-variant/20 px-4 py-3 text-sm font-bold text-on-surface-variant md:col-span-2">
          هذا الكود مُستخدَم بالفعل ولا يمكن تطبيقه مرة أخرى — التعديل هنا للأرشفة فقط.
        </p>
      ) : null}

      <CustomizedCouponFields
        lockIdentity
        defaults={{
          code: coupon.code,
          customerPhone: localPhone(coupon.customerPhone),
          kind: coupon.kind,
          value: coupon.value,
          scope: coupon.scope,
          endsAt: dateInputValue(coupon.endsAt),
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
