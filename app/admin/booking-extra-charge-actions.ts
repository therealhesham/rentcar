"use server";

import { revalidatePath } from "next/cache";
import {
  assertBookingRequestInScope,
  requirePermissionForAction,
} from "@/lib/admin-access";
import { logBookingEvent } from "@/lib/booking-audit";
import {
  DEFAULT_EXTRA_CHARGE_VAT_PERCENT,
  computeExtraChargeTotal,
  extraChargeKindLabelAr,
  isExtraChargeKind,
} from "@/lib/booking-extra-charges";
import { prisma } from "@/lib/prisma";

export type ExtraChargeActionResult = {
  ok: boolean;
  error?: string;
  /** رسالة تُعرض بعد نجاح العملية (مثل تنبيه أن المبلغ كان محصَّلاً بالفعل). */
  warning?: string;
};

/** الحالات التي لا يجوز إضافة رسوم عليها — الحجز منتهٍ إدارياً. */
const TERMINAL_STATUSES = new Set(["CANCELLED", "REJECTED"]);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function revalidateBooking(bookingId: number) {
  revalidatePath("/admin");
  revalidatePath("/admin/company-dues");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}/finance`);
  revalidatePath(`/admin/bookings/${bookingId}/statement`);
}

/**
 * تسجيل بند رسوم إضافية على حجز (تلفيات، وقود، مخالفة...).
 * يضيف الإجمالي شامل الضريبة إلى `balanceDueAtBranchSar` ليدخل مسار التحصيل
 * القائم (الفرع أو الدفع الأونلاين) بدل إنشاء مسار موازٍ.
 */
export async function addBookingExtraChargeAction(
  _prev: ExtraChargeActionResult | null,
  formData: FormData,
): Promise<ExtraChargeActionResult> {
  const auth = await requirePermissionForAction("FINANCIALS");
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingId = Number(formData.get("bookingId"));
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return { ok: false, error: "معرّف الحجز غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const kind = String(formData.get("kind") ?? "").trim().toUpperCase();
  const description = String(formData.get("description") ?? "").trim();
  const amountRaw = String(formData.get("amountExclTaxSar") ?? "").trim();
  const isTaxable = String(formData.get("isTaxable") ?? "") === "on";

  if (!isExtraChargeKind(kind)) return { ok: false, error: "يرجى اختيار نوع البند." };
  if (!description) return { ok: false, error: "يرجى كتابة وصف البند (سبب الرسوم)." };

  const amountExclTaxSar = round2(Number(amountRaw));
  if (!Number.isFinite(amountExclTaxSar) || amountExclTaxSar <= 0) {
    return { ok: false, error: "يرجى إدخال مبلغ صالح أكبر من صفر." };
  }

  const { vatRatePercent, amountInclTaxSar } = computeExtraChargeTotal(
    amountExclTaxSar,
    isTaxable,
    DEFAULT_EXTRA_CHARGE_VAT_PERCENT,
  );

  try {
    // القراءة والكتابة داخل نفس الـ transaction حتى لا يضيع بند أُضيف بالتوازي.
    const failure = await prisma.$transaction(async (tx) => {
      const booking = await tx.bookingRequest.findUnique({
        where: { id: bookingId },
        select: { status: true, balanceDueAtBranchSar: true },
      });
      if (!booking) return "الحجز غير موجود.";
      if (TERMINAL_STATUSES.has(booking.status.trim().toUpperCase())) {
        return "لا يمكن إضافة رسوم على حجز ملغى أو مرفوض.";
      }

      await tx.bookingExtraCharge.create({
        data: {
          bookingId,
          kind,
          description,
          amountExclTaxSar,
          isTaxable,
          vatRatePercent,
          amountInclTaxSar,
          createdBy: auth.session.displayName,
        },
      });
      await tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          balanceDueAtBranchSar: round2(
            (booking.balanceDueAtBranchSar ?? 0) + amountInclTaxSar,
          ),
        },
      });
      return null;
    });
    if (failure) return { ok: false, error: failure };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع.";
    return { ok: false, error: msg };
  }

  await logBookingEvent({
    bookingId,
    event: "EXTRA_CHARGE_ADDED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    notes: `${extraChargeKindLabelAr(kind)} — ${amountInclTaxSar} ر.س — ${description}`,
    meta: { kind, amountExclTaxSar, isTaxable, vatRatePercent, amountInclTaxSar },
  });

  revalidateBooking(bookingId);
  return { ok: true };
}

/**
 * إلغاء بند رسوم (خطأ إدخال أو إعفاء العميل). لا يُحذف السجل — يُعلَّم VOIDED
 * ويُخصم مبلغه من رصيد التحصيل.
 */
export async function voidBookingExtraChargeAction(
  chargeId: number,
  reason: string,
): Promise<ExtraChargeActionResult> {
  const auth = await requirePermissionForAction("FINANCIALS");
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!Number.isInteger(chargeId) || chargeId < 1) {
    return { ok: false, error: "معرّف البند غير صالح." };
  }
  const voidReason = reason.trim();
  if (!voidReason) return { ok: false, error: "يرجى كتابة سبب الإلغاء." };

  const charge = await prisma.bookingExtraCharge.findUnique({
    where: { id: chargeId },
    select: { bookingId: true, status: true, amountInclTaxSar: true },
  });
  if (!charge) return { ok: false, error: "البند غير موجود." };
  if (charge.status !== "ACTIVE") return { ok: false, error: "هذا البند ملغى بالفعل." };

  const scope = await assertBookingRequestInScope(auth.session, charge.bookingId);
  if (!scope.ok) return { ok: false, error: scope.error };

  let newBalance = 0;
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // إعادة القراءة داخل الـ transaction: الحالة والرصيد قد يتغيّرا بين الفحص والكتابة.
      const fresh = await tx.bookingExtraCharge.findUnique({
        where: { id: chargeId },
        select: { status: true, amountInclTaxSar: true },
      });
      if (!fresh) return { error: "البند غير موجود." } as const;
      if (fresh.status !== "ACTIVE") return { error: "هذا البند ملغى بالفعل." } as const;

      const booking = await tx.bookingRequest.findUnique({
        where: { id: charge.bookingId },
        select: { balanceDueAtBranchSar: true },
      });
      if (!booking) return { error: "الحجز غير موجود." } as const;

      const balance = round2((booking.balanceDueAtBranchSar ?? 0) - fresh.amountInclTaxSar);

      await tx.bookingExtraCharge.update({
        where: { id: chargeId },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          voidedBy: auth.session.displayName,
          voidReason,
        },
      });
      await tx.bookingRequest.update({
        where: { id: charge.bookingId },
        // رصيد سالب = البند حُصِّل بالفعل؛ نصفّره وننبّه الموظف ليردّ الفرق يدوياً.
        data: { balanceDueAtBranchSar: Math.max(0, balance) },
      });
      return { balance } as const;
    });
    if ("error" in outcome) return { ok: false, error: outcome.error };
    newBalance = outcome.balance;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع.";
    return { ok: false, error: msg };
  }

  const alreadyCollected = newBalance < 0;

  await logBookingEvent({
    bookingId: charge.bookingId,
    event: "EXTRA_CHARGE_VOIDED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    notes: `${charge.amountInclTaxSar} ر.س — ${voidReason}`,
    meta: { chargeId, amountInclTaxSar: charge.amountInclTaxSar, alreadyCollected },
  });

  revalidateBooking(charge.bookingId);
  return {
    ok: true,
    warning: alreadyCollected
      ? `تم إلغاء البند، لكن مبلغه كان محصَّلاً بالفعل — نفّذ استرداداً بقيمة ${round2(Math.abs(newBalance))} ر.س من قسم الاسترداد.`
      : undefined,
  };
}
