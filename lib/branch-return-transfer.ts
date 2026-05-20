import { prisma } from "@/lib/prisma";
import { adjustFleetQuantityDelta } from "@/lib/fleet-branch-stock";
import { isInterBranchPickupReturn } from "@/lib/booking-branches";

export async function confirmInterBranchReturn(input: {
  bookingRequestId: number;
  /** فرع الإرجاع لموظف الفرع (slug) — يجب أن يطابق returnBranch */
  actorReturnBranchSlug: string | null;
  isSuperAdmin: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const booking = await prisma.bookingRequest.findUnique({
    where: { id: input.bookingRequestId },
    select: {
      id: true,
      kind: true,
      carModelId: true,
      branchId: true,
      returnBranchId: true,
      pickupMode: true,
      addonsJson: true,
      interBranchReturnConfirmedAt: true,
      pickupBranch: { select: { slug: true } },
      returnBranch: { select: { slug: true } },
    },
  });

  if (!booking || booking.kind !== "DIRECT" || !booking.carModelId) {
    return { ok: false, error: "الطلب غير موجود أو ليس حجزاً مباشراً بسيارة." };
  }

  if (booking.interBranchReturnConfirmedAt) {
    return { ok: false, error: "تم تأكيد استلام هذه السيارة مسبقاً." };
  }

  if (!isInterBranchPickupReturn(booking)) {
    return { ok: false, error: "هذا الحجز ليس إرجاعاً من فرع استلام مختلف." };
  }

  const returnSlug = booking.returnBranch?.slug?.trim().toLowerCase();
  if (!returnSlug) {
    return { ok: false, error: "فرع الإرجاع غير محدد." };
  }

  if (!input.isSuperAdmin) {
    const actor = input.actorReturnBranchSlug?.trim().toLowerCase();
    if (!actor || actor !== returnSlug) {
      return { ok: false, error: "يمكنك تأكيد الاستلام لفرع الإرجاع الخاص بك فقط." };
    }
  }

  const pickupBranchId = booking.branchId;
  const returnBranchId = booking.returnBranchId;
  if (!pickupBranchId || !returnBranchId || pickupBranchId === returnBranchId) {
    return { ok: false, error: "فرع الاستلام أو الإرجاع غير محدد أو متطابق." };
  }

  const modelId = booking.carModelId;

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.bookingRequest.findUnique({
        where: { id: booking.id },
        select: { interBranchReturnConfirmedAt: true },
      });
      if (fresh?.interBranchReturnConfirmedAt) {
        throw new Error("ALREADY_CONFIRMED");
      }

      await adjustFleetQuantityDelta(tx, modelId, returnBranchId, 1);
      await adjustFleetQuantityDelta(tx, modelId, pickupBranchId, -1);

      await tx.bookingRequest.update({
        where: { id: booking.id },
        data: { interBranchReturnConfirmedAt: new Date() },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_CONFIRMED") {
      return { ok: false, error: "تم تأكيد استلام هذه السيارة مسبقاً." };
    }
    throw e;
  }

  return { ok: true };
}
